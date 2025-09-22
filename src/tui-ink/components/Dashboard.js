import React from 'react';
import { Text, Box } from 'ink';

export default function Dashboard({ onBack, stats }) {
    return React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { borderStyle: "round", borderColor: "cyan", padding: 1, marginBottom: 1 },
            React.createElement(Text, { bold: true, color: "cyan" }, "📊 Dashboard")
        ),
        React.createElement(Box, { borderStyle: "single", borderColor: "green", padding: 1, marginBottom: 1 },
            React.createElement(Text, { color: "green" }, "Dashboard functionality coming soon...")
        ),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", padding: 1 },
            React.createElement(Text, { dimColor: true }, "Press 'ESC' to return to main menu")
        )
    );
}