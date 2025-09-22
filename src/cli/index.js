#!/usr/bin/env node

import readline from 'readline';
import { JobProcessor } from '../services/jobProcessor.js';
import { ClaudeAnalyzer } from '../services/claudeAnalyzer.js';
import { NotificationService } from '../services/notificationService.js';
import { initDatabase, getDatabase } from '../database/init.js';
import { JOB_CATEGORIES } from '../api/fastwork.js';
import dotenv from 'dotenv';

dotenv.config();

class FastworkCLI {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.jobProcessor = new JobProcessor();
        this.claudeAnalyzer = new ClaudeAnalyzer(process.env.CLAUDE_API_KEY);
        this.notificationService = new NotificationService({
            facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
            facebookGroupId: process.env.FACEBOOK_GROUP_ID,
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
            telegramChatId: process.env.TELEGRAM_CHAT_ID
        });
    }

    async start() {
        console.log('\n🤖 Fastwork Job Bot - CLI Interface');
        console.log('=====================================\n');

        try {
            await initDatabase();
            console.log('✅ Database initialized\n');
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            this.rl.close();
            return;
        }

        this.showMainMenu();
    }

    showMainMenu() {
        console.log('📋 Main Menu:');
        console.log('1. 🚀 Fetch jobs workflow (no auto-analysis)');
        console.log('2. 📥 Fetch jobs only');
        console.log('3. 🧠 Analyze pending jobs (on-demand)');
        console.log('4. 📊 View job statistics');
        console.log('5. 🔧 Test API connections');
        console.log('6. 🌐 Start web server');
        console.log('7. ⚙️  Configure categories');
        console.log('8. 📱 View recent jobs');
        console.log('q. 🚪 Quit');
        console.log('');

        this.rl.question('Enter your choice: ', (answer) => {
            this.handleMenuChoice(answer.trim().toLowerCase());
        });
    }

    async handleMenuChoice(choice) {
        try {
            switch (choice) {
                case '1':
                    await this.runFullWorkflow();
                    break;
                case '2':
                    await this.fetchJobs();
                    break;
                case '3':
                    await this.analyzeJobs();
                    break;
                case '4':
                    await this.showStatistics();
                    break;
                case '5':
                    await this.testConnections();
                    break;
                case '6':
                    this.startWebServer();
                    break;
                case '7':
                    await this.configureCategories();
                    break;
                case '8':
                    await this.viewRecentJobs();
                    break;
                case 'q':
                case 'quit':
                case 'exit':
                    console.log('\n👋 Goodbye!');
                    this.rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log('❌ Invalid choice. Please try again.\n');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        console.log('\nPress Enter to continue...');
        this.rl.question('', () => {
            console.clear();
            this.showMainMenu();
        });
    }

    async runFullWorkflow() {
        console.log('\n🚀 Running job fetching workflow...\n');

        try {
            // Fetch jobs
            console.log('📥 Fetching jobs...');
            const processedJobs = await this.jobProcessor.processJobs(5);
            console.log(`✅ Processed ${processedJobs.length} jobs\n`);

            if (processedJobs.length === 0) {
                console.log('ℹ️  No new jobs found matching criteria');
                return;
            }

            console.log('ℹ️  Jobs are ready for analysis');
            console.log('💡 Use option 3 to analyze jobs or use the web interface\n');

            // Get already analyzed jobs for notification (don't trigger new analysis)
            const analyzedJobs = await this.claudeAnalyzer.getAnalyzedJobs();
            
            if (analyzedJobs.length > 0) {
                console.log('📢 Sending notifications for previously analyzed jobs...');
                const notificationResults = await this.notificationService.notifyNewJobs(analyzedJobs);
                
                console.log('📈 Notification Results:');
                notificationResults.forEach(result => {
                    if (result.error) {
                        console.log(`❌ Job ${result.jobId}: ${result.error}`);
                    } else {
                        console.log(`✅ Job ${result.jobId}: Notifications sent`);
                    }
                });
            } else {
                console.log('📢 No analyzed jobs available for notification');
                console.log('💡 Analyze jobs first, then run notifications');
            }

            console.log('\n🎉 Job fetching workflow completed successfully!');

        } catch (error) {
            console.error('❌ Workflow failed:', error.message);
        }
    }

    async fetchJobs() {
        console.log('\n📥 Fetching jobs from Fastwork API...\n');

        try {
            const processedJobs = await this.jobProcessor.processJobs(10);
            console.log(`✅ Successfully fetched and processed ${processedJobs.length} jobs`);

            if (processedJobs.length > 0) {
                console.log('\n📋 Fetched Jobs:');
                processedJobs.forEach((job, index) => {
                    const budget = job.budget ? `${job.budget.toLocaleString()} THB` : 'N/A';
                    console.log(`${index + 1}. ${job.title} - ${budget} (${job.category || 'Other'})`);
                });
            }
        } catch (error) {
            console.error('❌ Failed to fetch jobs:', error.message);
        }
    }

    async analyzeJobs() {
        console.log('\n🧠 Analyzing pending jobs with Claude AI...\n');

        try {
            const count = await this.claudeAnalyzer.analyzeAllPendingJobs();
            console.log(`✅ Successfully analyzed ${count} pending jobs`);
        } catch (error) {
            console.error('❌ Analysis failed:', error.message);
        }
    }

    async showStatistics() {
        console.log('\n📊 Job Statistics\n');

        try {
            const db = getDatabase();
            
            const stats = await new Promise((resolve, reject) => {
                const queries = [
                    'SELECT COUNT(*) as total FROM jobs',
                    'SELECT status, COUNT(*) as count FROM jobs GROUP BY status',
                    'SELECT kanban_status, COUNT(*) as count FROM jobs GROUP BY kanban_status',
                    'SELECT category, COUNT(*) as count FROM jobs GROUP BY category',
                    'SELECT AVG(budget) as avg_budget FROM jobs WHERE budget > 0'
                ];

                let results = {};
                let completed = 0;

                db.get(queries[0], (err, row) => {
                    if (err) reject(err);
                    else {
                        results.total = row.total;
                        completed++;
                        if (completed === 5) resolve(results);
                    }
                });

                db.all(queries[1], (err, rows) => {
                    if (err) reject(err);
                    else {
                        results.byStatus = rows;
                        completed++;
                        if (completed === 5) resolve(results);
                    }
                });

                db.all(queries[2], (err, rows) => {
                    if (err) reject(err);
                    else {
                        results.byKanban = rows;
                        completed++;
                        if (completed === 5) resolve(results);
                    }
                });

                db.all(queries[3], (err, rows) => {
                    if (err) reject(err);
                    else {
                        results.byCategory = rows;
                        completed++;
                        if (completed === 5) resolve(results);
                    }
                });

                db.get(queries[4], (err, row) => {
                    if (err) reject(err);
                    else {
                        results.avgBudget = Math.round(row.avg_budget || 0);
                        completed++;
                        if (completed === 5) resolve(results);
                    }
                });
            });

            db.close();

            console.log(`📈 Total Jobs: ${stats.total}`);
            console.log(`💰 Average Budget: ${stats.avgBudget.toLocaleString()} THB\n`);

            console.log('📊 By Processing Status:');
            stats.byStatus.forEach(item => {
                console.log(`   ${item.status}: ${item.count}`);
            });

            console.log('\n📋 By Kanban Status:');
            stats.byKanban.forEach(item => {
                console.log(`   ${item.kanban_status}: ${item.count}`);
            });

            console.log('\n📂 By Category:');
            stats.byCategory.forEach(item => {
                console.log(`   ${item.category || 'Unknown'}: ${item.count}`);
            });

        } catch (error) {
            console.error('❌ Failed to load statistics:', error.message);
        }
    }

    async testConnections() {
        console.log('\n🔍 Testing API connections...\n');

        try {
            // Test Fastwork API
            console.log('🌐 Testing Fastwork API...');
            const jobsResult = await this.jobProcessor.fastworkAPI.fetchJobs({ pageSize: 1 });
            console.log(`   ${jobsResult.success ? '✅ Connected' : '❌ Failed'}`);

            // Test Claude API
            console.log('🧠 Testing Claude API...');
            if (process.env.CLAUDE_API_KEY) {
                console.log('   ✅ API key configured');
            } else {
                console.log('   ⚠️  API key not configured');
            }

            // Test notification services
            console.log('📱 Testing notification services...');
            console.log(`   Facebook: ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
            console.log(`   Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`);

        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
        }
    }

    startWebServer() {
        console.log('\n🌐 Starting web server...');
        console.log('💡 Run the following command in a new terminal:');
        console.log('   npm run server');
        console.log('\n📋 Then visit: http://localhost:3000');
    }

    async configureCategories() {
        console.log('\n⚙️  Job Categories Configuration\n');

        const categories = Object.entries(JOB_CATEGORIES);
        categories.forEach(([key, category], index) => {
            console.log(`${index + 1}. ${category.nameEn} (${category.name})`);
            console.log(`   ID: ${category.id}`);
        });

        console.log('\n✅ All categories are currently enabled by default');
        console.log('💡 You can modify enabled categories in src/services/jobProcessor.js');
    }

    async viewRecentJobs() {
        console.log('\n📱 Recent Jobs (Last 10)\n');

        try {
            const db = getDatabase();
            
            const jobs = await new Promise((resolve, reject) => {
                const sql = 'SELECT * FROM jobs ORDER BY processed_at DESC LIMIT 10';
                
                db.all(sql, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            db.close();

            if (jobs.length === 0) {
                console.log('📭 No jobs found');
                return;
            }

            jobs.forEach((job, index) => {
                const budget = job.budget ? `${job.budget.toLocaleString()} THB` : 'N/A';
                const status = this.getStatusIcon(job.status);
                const kanban = job.kanban_status || 'jobs';
                
                console.log(`${index + 1}. ${job.title}`);
                console.log(`   💰 Budget: ${budget} | 📊 Status: ${status} | 📋 Column: ${kanban}`);
                console.log(`   🏷️  Category: ${job.category || 'Other'}`);
                console.log('');
            });

        } catch (error) {
            console.error('❌ Failed to load recent jobs:', error.message);
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

    close() {
        this.rl.close();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new FastworkCLI();
    cli.start().catch(console.error);
}

export { FastworkCLI };