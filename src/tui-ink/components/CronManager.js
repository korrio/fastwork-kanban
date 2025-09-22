import React from 'react';
import { Text, Box } from 'ink';

export default function CronManager({ onBack }) {
    return React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { borderStyle: "round", borderColor: "magenta", padding: 1, marginBottom: 1 },
            React.createElement(Text, { bold: true, color: "magenta" }, "⏰ Cron Job Manager")
        ),
        React.createElement(Box, { borderStyle: "single", borderColor: "blue", padding: 1, marginBottom: 1 },
            React.createElement(Text, { color: "blue" }, "Cron management functionality coming soon...")
        ),
        React.createElement(Box, { borderStyle: "single", borderColor: "gray", padding: 1 },
            React.createElement(Text, { dimColor: true }, "Press 'ESC' to return to main menu")
        )
    );
}