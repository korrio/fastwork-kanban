#!/usr/bin/env node
import { spawn } from 'child_process';
import chalk from 'chalk';

const args = process.argv.slice(2);
const command = args[0];

const commands = {
    start: {
        desc: 'Start both server and cron processes',
        cmd: 'pm2 start ecosystem.config.cjs'
    },
    stop: {
        desc: 'Stop all processes',
        cmd: 'pm2 stop ecosystem.config.cjs'
    },
    restart: {
        desc: 'Restart all processes',
        cmd: 'pm2 restart ecosystem.config.cjs'
    },
    delete: {
        desc: 'Delete all processes',
        cmd: 'pm2 delete ecosystem.config.cjs'
    },
    status: {
        desc: 'Show process status',
        cmd: 'pm2 status'
    },
    logs: {
        desc: 'Show logs (real-time)',
        cmd: 'pm2 logs'
    },
    cron: {
        desc: 'Start only cron job',
        cmd: 'pm2 start ecosystem.config.cjs --only fastwork-cron'
    },
    server: {
        desc: 'Start only web server',
        cmd: 'pm2 start ecosystem.config.cjs --only fastwork-server'
    },
    monit: {
        desc: 'Open PM2 monitoring dashboard',
        cmd: 'pm2 monit'
    },
    save: {
        desc: 'Save current process list for startup',
        cmd: 'pm2 save'
    },
    startup: {
        desc: 'Generate startup script',
        cmd: 'pm2 startup'
    }
};

function showHelp() {
    console.log(chalk.cyan.bold('\n🤖 Fastwork PM2 Manager\n'));
    console.log(chalk.yellow('Available commands:'));
    
    Object.entries(commands).forEach(([cmd, { desc }]) => {
        console.log(`  ${chalk.green(cmd.padEnd(10))} - ${desc}`);
    });
    
    console.log(chalk.gray('\nExample: node pm2-manager.js start'));
    console.log(chalk.gray('         npm run pm2:start\n'));
}

function runCommand(cmdString) {
    console.log(chalk.blue(`Running: ${cmdString}\n`));
    
    const [cmd, ...cmdArgs] = cmdString.split(' ');
    const child = spawn(cmd, cmdArgs, {
        stdio: 'inherit',
        shell: true
    });
    
    child.on('error', (error) => {
        console.error(chalk.red(`Error: ${error.message}`));
        console.log(chalk.yellow('Make sure PM2 is installed: npm install -g pm2'));
    });
    
    child.on('close', (code) => {
        if (code !== 0) {
            console.error(chalk.red(`Command failed with exit code ${code}`));
        }
    });
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
}

if (commands[command]) {
    runCommand(commands[command].cmd);
} else {
    console.error(chalk.red(`Unknown command: ${command}`));
    showHelp();
    process.exit(1);
}