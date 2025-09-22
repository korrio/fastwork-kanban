import blessed from 'blessed';
import contrib from 'blessed-contrib';
import moment from 'moment';
import { JobProcessor } from '../services/jobProcessor.js';
import { ClaudeAnalyzer } from '../services/claudeAnalyzer.js';
import { NotificationService } from '../services/notificationService.js';
import { getDatabase, initDatabase } from '../database/init.js';
import { JobDetailsModal } from './components/JobDetailsModal.js';
import { HelpModal } from './components/HelpModal.js';
import { CategorySelector } from './components/CategorySelector.js';
import { CategoryManager } from '../config/categories.js';
import dotenv from 'dotenv';

dotenv.config();

export class FastworkTUI {
    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Fastwork Job Bot - Terminal UI',
            dockBorders: true,
            ignoreLocked: ['C-c']
        });

        this.jobProcessor = new JobProcessor();
        this.claudeAnalyzer = new ClaudeAnalyzer(process.env.CLAUDE_API_KEY);
        this.notificationService = new NotificationService({
            facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
            facebookGroupId: process.env.FACEBOOK_GROUP_ID,
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
            telegramChatId: process.env.TELEGRAM_CHAT_ID
        });

        this.currentView = 'dashboard';
        this.isRunning = false;
        this.refreshInterval = null;
        this.recentJobs = [];
        
        this.jobDetailsModal = new JobDetailsModal(this.screen);
        this.helpModal = new HelpModal(this.screen);
        this.categorySelector = new CategorySelector(this.screen);
        this.categoryManager = new CategoryManager();
        
        this.initializeComponents();
        this.setupEventHandlers();
        this.setupKeyBindings();
    }

    initializeComponents() {
        this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

        this.createHeader();
        this.createMenu();
        this.createStatusPanel();
        this.createJobsList();
        this.createLogPanel();
        this.createProgressBar();
    }

    createHeader() {
        this.header = this.grid.set(0, 0, 1, 12, blessed.box, {
            content: '{center}🤖 Fastwork Job Bot - Terminal UI{/center}',
            tags: true,
            style: {
                fg: 'white',
                bg: 'blue',
                bold: true
            }
        });
    }

    createMenu() {
        this.menu = this.grid.set(1, 0, 1, 12, blessed.listbar, {
            commands: {
                'Dashboard': { callback: () => this.switchView('dashboard') },
                'Jobs': { callback: () => this.switchView('jobs') },
                'Categories': { callback: () => this.showCategorySelector() },
                'Run Bot': { callback: () => this.runBot() },
                'Analyze': { callback: () => this.analyzeJobs() },
                'Test APIs': { callback: () => this.testConnections() },
                'Config': { callback: () => this.switchView('config') },
                'Quit': { callback: () => this.quit() }
            },
            style: {
                fg: 'white',
                bg: 'black',
                selected: {
                    bg: 'green',
                    fg: 'black'
                }
            }
        });
    }

    createStatusPanel() {
        this.statusPanel = this.grid.set(2, 0, 3, 6, blessed.box, {
            label: ' System Status ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' }
            },
            scrollable: true,
            mouse: true
        });
    }

    createJobsList() {
        this.jobsList = this.grid.set(2, 6, 6, 6, blessed.listtable, {
            label: ' Recent Jobs ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                header: { fg: 'white', bold: true },
                cell: { selected: { bg: 'blue' } }
            },
            keys: true,
            mouse: true,
            interactive: true,
            data: [
                ['Title', 'Budget', 'Status', 'Date']
            ]
        });
    }

    createLogPanel() {
        this.logPanel = this.grid.set(5, 0, 6, 6, blessed.log, {
            label: ' Activity Log ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' }
            },
            mouse: true,
            scrollback: 1000,
            scrollOnInput: true
        });
    }

    createProgressBar() {
        this.progressBar = this.grid.set(11, 0, 1, 12, blessed.progressbar, {
            orientation: 'horizontal',
            style: {
                bar: { bg: 'green' },
                border: { fg: 'cyan' }
            },
            filled: 0
        });
    }

    setupEventHandlers() {
        this.jobsList.on('select', (item, index) => {
            if (index > 0 && this.recentJobs[index - 1]) {
                this.showJobDetails(index - 1);
            }
        });

        this.menu.on('keypress', () => {
            this.screen.render();
        });
    }

    setupKeyBindings() {
        this.screen.key(['escape', 'q', 'C-c'], () => {
            this.quit();
        });

        this.screen.key(['r'], () => {
            this.runBot();
        });

        this.screen.key(['a'], () => {
            this.analyzeJobs();
        });

        this.screen.key(['t'], () => {
            this.testConnections();
        });

        this.screen.key(['f5'], () => {
            this.refreshData();
        });

        this.screen.key(['tab'], () => {
            this.menu.focus();
        });

        this.screen.key(['h', '?'], () => {
            this.helpModal.show();
        });

        this.screen.key(['c'], () => {
            this.showCategorySelector();
        });
    }

    switchView(view) {
        this.currentView = view;
        this.log(`Switched to ${view} view`);
        
        switch (view) {
            case 'dashboard':
                this.showDashboard();
                break;
            case 'jobs':
                this.showJobsView();
                break;
            case 'config':
                this.showConfigView();
                break;
        }
        
        this.screen.render();
    }

    showDashboard() {
        this.updateStatusPanel();
        this.refreshJobsList();
    }

    showJobsView() {
        this.refreshJobsList();
        this.jobsList.focus();
    }

    showConfigView() {
        const enabledCategories = this.categoryManager.getEnabledCategories();
        const allCategories = this.categoryManager.getAllCategories();
        
        const categoryList = allCategories.map(cat => {
            const enabled = enabledCategories.includes(cat.id);
            return `  ${enabled ? '✅' : '❌'} ${cat.nameEn} (${cat.name})`;
        }).join('\n');

        const config = `
Configuration Status:

API Keys:
  Claude API: ${process.env.CLAUDE_API_KEY ? '✅ Configured' : '❌ Not configured'}
  
Social Media:
  Facebook Token: ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}
  Facebook Group: ${process.env.FACEBOOK_GROUP_ID ? '✅ Configured' : '❌ Not configured'}
  Telegram Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}
  Telegram Chat: ${process.env.TELEGRAM_CHAT_ID ? '✅ Configured' : '❌ Not configured'}

Job Categories (${enabledCategories.length}/${allCategories.length} enabled):
${categoryList}

Settings:
  Minimum Budget: 10,000 THB
  Max Jobs per Run: 5
  Database: jobs.db

Environment File: ${process.env.NODE_ENV || 'development'}

Press 'C' to configure categories
        `.trim();

        this.statusPanel.setContent(config);
    }

    async updateStatusPanel() {
        try {
            const stats = await this.getSystemStats();
            
            const statusContent = `
🎯 System Overview:

Database:
  Total Jobs: ${stats.totalJobs}
  Pending Analysis: ${stats.pendingJobs}
  Analyzed Jobs: ${stats.analyzedJobs}
  Notified Jobs: ${stats.notifiedJobs}

Recent Activity:
  Last Run: ${stats.lastRun || 'Never'}
  Jobs Today: ${stats.jobsToday}
  Success Rate: ${stats.successRate}%

Bot Status: ${this.isRunning ? '🟢 Running' : '🔴 Idle'}

Press 'r' to run bot
Press 'a' to analyze jobs
Press 't' to test connections
Press 'F5' to refresh
            `.trim();

            this.statusPanel.setContent(statusContent);
            this.screen.render();
        } catch (error) {
            this.log(`Error updating status: ${error.message}`, 'error');
        }
    }

    async refreshJobsList() {
        try {
            this.recentJobs = await this.getRecentJobs(10);
            
            const tableData = [
                ['Title', 'Budget', 'Status', 'Date']
            ];

            this.recentJobs.forEach(job => {
                const title = job.title && job.title.length > 30 ? job.title.substring(0, 27) + '...' : (job.title || 'No title');
                const budget = job.budget ? `${job.budget.toLocaleString()} THB` : 'N/A';
                const status = this.getStatusIcon(job.status);
                const date = job.created_at ? moment(job.created_at).format('MM/DD HH:mm') : 'N/A';
                
                tableData.push([title, budget, status, date]);
            });

            if (this.jobsList && this.jobsList.setData) {
                this.jobsList.setData(tableData);
                this.screen.render();
            }
        } catch (error) {
            this.log(`Error refreshing jobs list: ${error.message}`, 'error');
        }
    }

    getStatusIcon(status) {
        const icons = {
            'pending': '⏳ Pending',
            'analyzed': '🧠 Analyzed',
            'notified': '📢 Notified',
            'error': '❌ Error'
        };
        return icons[status] || '❓ Unknown';
    }

    async runBot() {
        if (this.isRunning) {
            this.log('Bot is already running!', 'warning');
            return;
        }

        this.isRunning = true;
        this.progressBar.setProgress(0);
        this.log('🚀 Starting bot execution...', 'info');

        try {
            this.progressBar.setProgress(10);
            await initDatabase();
            this.log('✅ Database initialized', 'success');

            this.progressBar.setProgress(30);
            const enabledCategories = this.categoryManager.getEnabledCategories();
            const processedJobs = await this.jobProcessor.processJobs(5, enabledCategories);
            this.log(`✅ Processed ${processedJobs.length} jobs from ${enabledCategories.length} categories`, 'success');

            this.progressBar.setProgress(60);
            if (processedJobs.length > 0) {
                const analyzedCount = await this.claudeAnalyzer.analyzeAllPendingJobs();
                this.log(`✅ Analyzed ${analyzedCount} jobs`, 'success');
            }

            this.progressBar.setProgress(80);
            const analyzedJobs = await this.claudeAnalyzer.getAnalyzedJobs();
            
            if (analyzedJobs.length > 0) {
                const notificationResults = await this.notificationService.notifyNewJobs(analyzedJobs);
                this.log(`📢 Sent ${notificationResults.length} notifications`, 'success');
            }

            this.progressBar.setProgress(100);
            this.log('🎉 Bot execution completed successfully!', 'success');

        } catch (error) {
            this.log(`❌ Bot execution failed: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
            setTimeout(() => {
                this.progressBar.setProgress(0);
                this.refreshData();
            }, 2000);
        }
    }

    async analyzeJobs() {
        this.log('🧠 Starting job analysis...', 'info');
        
        try {
            const count = await this.claudeAnalyzer.analyzeAllPendingJobs();
            this.log(`✅ Analyzed ${count} pending jobs`, 'success');
            this.refreshData();
        } catch (error) {
            this.log(`❌ Analysis failed: ${error.message}`, 'error');
        }
    }

    async testConnections() {
        this.log('🔍 Testing API connections...', 'info');
        
        try {
            const jobsResult = await this.jobProcessor.fastworkAPI.fetchJobs({ pageSize: 1 });
            this.log(`Fastwork API: ${jobsResult.success ? '✅ Connected' : '❌ Failed'}`, 
                     jobsResult.success ? 'success' : 'error');

            if (process.env.CLAUDE_API_KEY) {
                this.log('Claude API: ✅ Key configured', 'success');
            } else {
                this.log('Claude API: ⚠️ Key not configured', 'warning');
            }

            this.log(`Facebook: ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}`, 
                     process.env.FACEBOOK_ACCESS_TOKEN ? 'success' : 'warning');
            
            this.log(`Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`, 
                     process.env.TELEGRAM_BOT_TOKEN ? 'success' : 'warning');

        } catch (error) {
            this.log(`❌ Connection test failed: ${error.message}`, 'error');
        }
    }

    async getSystemStats() {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as total FROM jobs',
                'SELECT COUNT(*) as pending FROM jobs WHERE status = "pending"',
                'SELECT COUNT(*) as analyzed FROM jobs WHERE status = "analyzed"', 
                'SELECT COUNT(*) as notified FROM jobs WHERE status = "notified"',
                'SELECT COUNT(*) as today FROM jobs WHERE date(processed_at) = date("now")',
                'SELECT processed_at FROM jobs ORDER BY processed_at DESC LIMIT 1'
            ];

            let results = {};
            let completed = 0;

            queries.forEach((query, index) => {
                db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    switch (index) {
                        case 0: results.totalJobs = row.total; break;
                        case 1: results.pendingJobs = row.pending; break;
                        case 2: results.analyzedJobs = row.analyzed; break;
                        case 3: results.notifiedJobs = row.notified; break;
                        case 4: results.jobsToday = row.today; break;
                        case 5: results.lastRun = row.processed_at ? moment(row.processed_at).fromNow() : null; break;
                    }

                    completed++;
                    if (completed === queries.length) {
                        results.successRate = results.totalJobs > 0 
                            ? Math.round((results.notifiedJobs / results.totalJobs) * 100) 
                            : 0;
                        
                        db.close();
                        resolve(results);
                    }
                });
            });
        });
    }

    async getRecentJobs(limit = 10) {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM jobs ORDER BY processed_at DESC LIMIT ?';
            
            db.all(sql, [limit], (err, rows) => {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    showJobDetails(jobIndex) {
        if (this.recentJobs[jobIndex]) {
            this.jobDetailsModal.show(this.recentJobs[jobIndex]);
        }
    }

    showCategorySelector() {
        this.categorySelector.show((enabledCategories) => {
            this.log(`Updated categories: ${enabledCategories.length} enabled`, 'info');
            this.refreshData();
        });
    }

    refreshData() {
        this.updateStatusPanel();
        this.refreshJobsList();
    }

    log(message, type = 'info') {
        const timestamp = moment().format('HH:mm:ss');
        const prefix = {
            'info': '📘',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        }[type] || 'ℹ️';

        this.logPanel.log(`${prefix} [${timestamp}] ${message}`);
        this.screen.render();
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (!this.isRunning) {
                this.refreshData();
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    quit() {
        this.stopAutoRefresh();
        this.screen.destroy();
        process.exit(0);
    }

    async start() {
        try {
            this.log('🚀 Fastwork Job Bot TUI Started', 'success');
            this.log('Use Tab to navigate, F5 to refresh, H for help, Q to quit', 'info');
            
            await this.refreshData();
            this.startAutoRefresh();
            this.screen.render();
        } catch (error) {
            console.error('Error starting TUI:', error);
            console.log('Falling back to simple terminal interface...');
            this.fallbackInterface();
        }
    }

    fallbackInterface() {
        console.log('\n=== Fastwork Job Bot - Simple Interface ===');
        console.log('TUI initialization failed. Using basic terminal interface.\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const showMenu = () => {
            console.log('\nAvailable commands:');
            console.log('1. Run bot');
            console.log('2. Analyze jobs');
            console.log('3. Test connections');
            console.log('4. Start web server');
            console.log('q. Quit');
            console.log('');
        };

        const handleCommand = async (command) => {
            switch (command.trim().toLowerCase()) {
                case '1':
                    console.log('Starting bot execution...');
                    await this.runBot();
                    break;
                case '2':
                    console.log('Analyzing jobs...');
                    await this.analyzeJobs();
                    break;
                case '3':
                    console.log('Testing connections...');
                    await this.testConnections();
                    break;
                case '4':
                    console.log('Starting web server...');
                    console.log('Run: npm run server');
                    break;
                case 'q':
                case 'quit':
                case 'exit':
                    console.log('Goodbye!');
                    rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log('Invalid command. Please try again.');
            }
            
            rl.question('Enter command (or "q" to quit): ', handleCommand);
        };

        showMenu();
        rl.question('Enter command (or "q" to quit): ', handleCommand);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const tui = new FastworkTUI();
    await tui.start();
}