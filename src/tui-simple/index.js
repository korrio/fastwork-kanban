#!/usr/bin/env node
import readline from 'readline';
import chalk from 'chalk';

console.clear();
console.log(chalk.cyan.bold('🤖 Fastwork Job Bot - Terminal Interface'));
console.log(chalk.gray('Simple CLI version (compatible with all terminals)'));
console.log(chalk.gray('═'.repeat(60)));
console.log();

console.log(chalk.yellow.bold('📋 Available Commands:'));
console.log(chalk.green('1. npm run pm2:start') + ' - Start both server & cron with PM2 (recommended)');
console.log(chalk.green('2. npm run pm2:cron') + ' - Start only cron job with PM2');
console.log(chalk.green('3. npm run pm2:server') + ' - Start only web server with PM2');
console.log(chalk.green('4. npm run pm2:status') + ' - Check PM2 process status');
console.log(chalk.green('5. npm run pm2:logs') + ' - View PM2 logs');
console.log(chalk.green('6. npm run pm2:stop') + ' - Stop all PM2 processes');
console.log();

console.log(chalk.cyan.bold('🚀 Quick Start (PM2 - Recommended):'));
console.log('1. Run ' + chalk.yellow('"npm install"') + ' to install PM2');
console.log('2. Run ' + chalk.yellow('"npm run pm2:start"') + ' to start both services');
console.log('3. Open ' + chalk.blue('http://localhost:3000') + ' in your browser');
console.log('4. Use ' + chalk.yellow('"npm run pm2:status"') + ' to monitor processes');
console.log();

console.log(chalk.magenta.bold('📊 System Features:'));
console.log('• Automatic job fetching every 5 minutes');
console.log('• 4 job categories: App Dev, Web Dev, IT Solutions, IoT');
console.log('• Budget filtering (≥5,000 THB)');
console.log('• Drag & drop Kanban board');
console.log('• AI-powered job analysis');
console.log('• SQLite persistence with localStorage sync');
console.log();

console.log(chalk.blue.bold('🌐 Web Interface:'));
console.log('The web interface provides the full job management experience:');
console.log('• Interactive Kanban board (Jobs → Interested → Proposed → Archived)');
console.log('• Real-time job fetching and analysis');
console.log('• Detailed job views with AI insights');
console.log('• Category-based organization and filtering');
console.log();

console.log(chalk.magenta.bold('🔧 PM2 Benefits:'));
console.log('• Automatic process restart on crashes');
console.log('• Built-in log management and rotation');
console.log('• Process monitoring and resource tracking');
console.log('• Zero-downtime restarts and updates');
console.log('• Startup script generation for system boot');
console.log();

console.log(chalk.green.bold('✅ All systems operational with PM2!'));
console.log(chalk.gray('Press Ctrl+C to exit'));

// Keep the process running
process.stdin.resume();

process.on('SIGINT', () => {
    console.log(chalk.green('\n👋 Goodbye!'));
    process.exit(0);
});