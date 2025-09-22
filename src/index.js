import dotenv from 'dotenv';
import { initDatabase } from './database/init.js';
import { JobProcessor } from './services/jobProcessor.js';
import { ClaudeAnalyzer } from './services/claudeAnalyzer.js';
import { NotificationService } from './services/notificationService.js';

dotenv.config();

class FastworkJobBot {
    constructor() {
        this.jobProcessor = new JobProcessor();
        this.claudeAnalyzer = new ClaudeAnalyzer(process.env.CLAUDE_API_KEY);
        this.notificationService = new NotificationService({
            facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
            facebookGroupId: process.env.FACEBOOK_GROUP_ID,
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
            telegramChatId: process.env.TELEGRAM_CHAT_ID
        });
    }

    async run() {
        try {
            console.log('🤖 Starting Fastwork Job Bot...');
            
            await initDatabase();
            console.log('✅ Database initialized');

            console.log('📥 Fetching and processing jobs...');
            const processedJobs = await this.jobProcessor.processJobs(5);
            console.log(`✅ Processed ${processedJobs.length} jobs`);

            if (processedJobs.length === 0) {
                console.log('ℹ️  No new jobs found matching criteria');
                return;
            }

            console.log('ℹ️  Jobs are ready for analysis (use web interface or CLI to analyze)');
            console.log('📊 Getting jobs for potential notification...');
            
            // Only get already analyzed jobs, don't trigger new analysis
            const analyzedJobs = await this.claudeAnalyzer.getAnalyzedJobs();
            
            if (analyzedJobs.length > 0) {
                console.log('📢 Sending notifications...');
                const notificationResults = await this.notificationService.notifyNewJobs(analyzedJobs);
                
                console.log('📈 Notification Results:');
                notificationResults.forEach(result => {
                    if (result.error) {
                        console.log(`❌ Job ${result.jobId}: ${result.error}`);
                    } else {
                        console.log(`✅ Job ${result.jobId}: Notifications sent`);
                    }
                });
            }

            console.log('🎉 Job bot run completed successfully!');
            
        } catch (error) {
            console.error('❌ Error running job bot:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    async testConnection() {
        try {
            console.log('🔍 Testing API connections...');
            
            const jobsResult = await this.jobProcessor.fastworkAPI.fetchJobs({ pageSize: 1 });
            console.log(`✅ Fastwork API: ${jobsResult.success ? 'Connected' : 'Failed'}`);
            
            if (process.env.CLAUDE_API_KEY) {
                console.log('✅ Claude API key configured');
            } else {
                console.log('⚠️  Claude API key not configured');
            }
            
            console.log('🔗 Notification services:');
            console.log(`  Facebook: ${process.env.FACEBOOK_ACCESS_TOKEN ? 'Configured' : 'Not configured'}`);
            console.log(`  Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
            
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
        }
    }
}

const command = process.argv[2];
const bot = new FastworkJobBot();

switch (command) {
    case 'test':
        await bot.testConnection();
        break;
    case 'analyze':
        await bot.claudeAnalyzer.analyzeAllPendingJobs();
        break;
    default:
        await bot.run();
}

process.exit(0);