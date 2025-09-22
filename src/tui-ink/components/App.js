import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import MainMenu from './MainMenu.js';
import JobList from './JobList.js';
import Dashboard from './Dashboard.js';
import CronManager from './CronManager.js';

export default function App() {
    const [currentView, setCurrentView] = useState('menu');
    const [stats, setStats] = useState(null);
    const { exit } = useApp();

    useInput((input, key) => {
        if (input === 'q' || (key.ctrl && input === 'c')) {
            exit();
        }
        if (key.escape) {
            setCurrentView('menu');
        }
    });

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000); // Update stats every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/jobs/stats/overview');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            // Silently handle - server might not be running
        }
    };

    const renderHeader = () => {
        return React.createElement(Box, { borderStyle: "round", borderColor: "blue", padding: 1, marginBottom: 1 },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true, color: "cyan" }, "🤖 Fastwork Job Bot - Terminal Interface"),
                React.createElement(Text, { dimColor: true }, "Press 'q' to quit, 'ESC' to return to menu"),
                stats && React.createElement(Box, { marginTop: 1, flexDirection: "row", justifyContent: "space-between" },
                    React.createElement(Text, null, "Total Jobs: ", React.createElement(Text, { color: "green" }, stats.total || 0)),
                    React.createElement(Text, null, "Interested: ", React.createElement(Text, { color: "yellow" }, stats.byStatus?.interested || 0)),
                    React.createElement(Text, null, "Proposed: ", React.createElement(Text, { color: "blue" }, stats.byStatus?.proposed || 0)),
                    React.createElement(Text, null, "Avg Budget: ", React.createElement(Text, { color: "magenta" }, (stats.avgBudget?.toLocaleString() || 0) + " THB"))
                )
            )
        );
    };

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return React.createElement(Dashboard, { onBack: () => setCurrentView('menu'), stats: stats });
            case 'jobs':
                return React.createElement(JobList, { onBack: () => setCurrentView('menu') });
            case 'cron':
                return React.createElement(CronManager, { onBack: () => setCurrentView('menu') });
            default:
                return React.createElement(MainMenu, { onSelect: setCurrentView, stats: stats });
        }
    };

    return React.createElement(Box, { flexDirection: "column", padding: 1 },
        renderHeader(),
        renderView()
    );
}