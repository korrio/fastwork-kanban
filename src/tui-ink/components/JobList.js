import React from 'react';
import { Text, Box } from 'ink';

export default function JobList({ onBack }) {
    return React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { borderStyle: "round", borderColor: "green", padding: 1, marginBottom: 1 },
            React.createElement(Text, { bold: true, color: "green" }, "📋 Jobs List")
        ),
        React.createElement(Box, { borderStyle: "single", borderColor: "yellow", padding: 1, marginBottom: 1 },
            React.createElement(Text, { color: "yellow" }, "Job list functionality coming soon...")
        ),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", padding: 1 },
            React.createElement(Text, { dimColor: true }, "Press 'ESC' to return to main menu")
        )
    );
}