import React, { useState } from 'react';
import { Text, Box } from 'ink';
import SelectInput from 'ink-select-input';

export default function MainMenu({ onSelect, stats }) {
    const menuItems = [
        {
            label: '📊 Dashboard - View job statistics and analytics',
            value: 'dashboard'
        },
        {
            label: '📋 Jobs List - Browse and manage jobs',
            value: 'jobs'
        },
        {
            label: '⏰ Cron Manager - Manage automatic job fetching',
            value: 'cron'
        },
        {
            label: '🌐 Open Web Interface - Launch browser Kanban board',
            value: 'web'
        },
        {
            label: '❌ Exit Application',
            value: 'exit'
        }
    ];

    const handleSelect = (item) => {
        if (item.value === 'exit') {
            process.exit(0);
        } else if (item.value === 'web') {
            // Open web interface
            const { spawn } = require('child_process');
            spawn('open', ['http://localhost:3000'], { detached: true });
            console.log('\n🌐 Opening web interface at http://localhost:3000');
            console.log('💡 Make sure to run "npm run server" in another terminal first!\n');
        } else {
            onSelect(item.value);
        }
    };

    return React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { borderStyle: "round", borderColor: "green", padding: 1, marginBottom: 1 },
            React.createElement(Text, { bold: true, color: "green" }, "📋 Main Menu")
        ),
        
        stats && React.createElement(Box, { borderStyle: "single", borderColor: "gray", padding: 1, marginBottom: 1 },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true, color: "cyan" }, "📈 Quick Stats"),
                React.createElement(Box, { marginTop: 1, flexDirection: "row", justifyContent: "space-between" },
                    React.createElement(Text, null, "Jobs: ", React.createElement(Text, { color: "green" }, stats.total || 0)),
                    React.createElement(Text, null, "Interested: ", React.createElement(Text, { color: "yellow" }, stats.byStatus?.interested || 0)),
                    React.createElement(Text, null, "Proposed: ", React.createElement(Text, { color: "blue" }, stats.byStatus?.proposed || 0))
                ),
                React.createElement(Text, { marginTop: 1 }, "Average Budget: ", React.createElement(Text, { color: "magenta" }, (stats.avgBudget?.toLocaleString() || 0) + " THB"))
            )
        ),

        React.createElement(Box, { borderStyle: "single", borderColor: "yellow", padding: 1 },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true, color: "yellow", marginBottom: 1 }, "Select an option:"),
                React.createElement(SelectInput, { items: menuItems, onSelect: handleSelect })
            )
        ),

        React.createElement(Box, { marginTop: 1, borderStyle: "single", borderColor: "gray", padding: 1 },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true, color: "gray" }, "💡 Quick Actions:"),
                React.createElement(Text, { dimColor: true }, "• Run \"npm run server\" to start web interface"),
                React.createElement(Text, { dimColor: true }, "• Run \"npm run cron\" to start automatic fetching"),
                React.createElement(Text, { dimColor: true }, "• Use arrow keys to navigate, Enter to select")
            )
        )
    );
}