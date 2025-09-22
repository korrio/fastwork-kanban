#!/usr/bin/env node
import cron from 'node-cron';
import dotenv from 'dotenv';
import { JobProcessor } from '../services/jobProcessor.js';
import { initDatabase } from '../database/init.js';
import moment from 'moment';
import logger from '../utils/logger.js';

dotenv.config();

class FastworkCronJob {
    constructor() {
        this.jobProcessor = new JobProcessor();
        this.isRunning = false;
        this.lastRun = null;
        this.totalJobsFetched = 0;
        this.errors = [];
        this.startTime = new Date();
    }

    async initialize() {
        try {
            await initDatabase();
            console.log('✅ Database initialized for cron job');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize database:', error.message);
            return false;
        }
    }

    async fetchJobs() {
        if (this.isRunning) {
            logger.logCronActivity('SKIP_CYCLE', 'Previous job still running, skipping this cycle');
            return;
        }

        this.isRunning = true;
        const startTime = new Date();
        
        try {
            logger.logCronActivity('START_FETCH', `Starting scheduled job fetch cycle ${this.totalJobsFetched > 0 ? `(total runs: ${Math.floor(this.totalJobsFetched / 30) + 1})` : ''}`);
            
            // Fetch jobs from all 4 categories
            const processedJobs = await this.jobProcessor.processJobs(30); // Fetch more jobs in cron
            
            const endTime = new Date();
            const duration = endTime - startTime;
            
            this.lastRun = endTime;
            this.totalJobsFetched += processedJobs.length;
            
            logger.logCronActivity('FETCH_COMPLETE', `Completed fetch cycle`, {
                duration: `${duration}ms`,
                jobsFetched: processedJobs.length,
                totalJobs: this.totalJobsFetched,
                newJobs: processedJobs.map(job => ({
                    id: job.id,
                    title: job.title,
                    budget: job.budget,
                    category: job.category
                }))
            });
            
            if (processedJobs.length > 0) {
                console.log('📋 New jobs added:');
                processedJobs.forEach((job, index) => {
                    const budget = job.budget ? `${job.budget.toLocaleString()} THB` : 'N/A';
                    console.log(`   ${index + 1}. ${job.title} - ${budget} (${job.category})`);
                });
            } else {
                logger.logCronActivity('NO_NEW_JOBS', 'No new jobs found this cycle');
            }

        } catch (error) {
            const duration = new Date() - startTime;
            logger.logCronActivity('FETCH_ERROR', `Job fetch failed after ${duration}ms`, {
                error: error.message,
                stack: error.stack
            });
            
            this.errors.push({
                timestamp: new Date(),
                error: error.message
            });
            
            // Keep only last 10 errors
            if (this.errors.length > 10) {
                this.errors = this.errors.slice(-10);
            }
        } finally {
            this.isRunning = false;
        }
    }

    getStatus() {
        const uptime = Math.floor((new Date() - this.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;

        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun ? moment(this.lastRun).format('YYYY-MM-DD HH:mm:ss') : 'Never',
            totalJobsFetched: this.totalJobsFetched,
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            errors: this.errors.length,
            lastError: this.errors.length > 0 ? this.errors[this.errors.length - 1] : null
        };
    }

    printStatus() {
        const status = this.getStatus();
        console.log('\n📊 Cron Job Status:');
        console.log(`   🔄 Running: ${status.isRunning ? 'Yes' : 'No'}`);
        console.log(`   🕐 Last Run: ${status.lastRun}`);
        console.log(`   📈 Total Jobs: ${status.totalJobsFetched}`);
        console.log(`   ⏱️  Uptime: ${status.uptime}`);
        console.log(`   ❌ Errors: ${status.errors}`);
        
        if (status.lastError) {
            console.log(`   🚨 Last Error: ${moment(status.lastError.timestamp).fromNow()} - ${status.lastError.error}`);
        }
    }

    start() {
        logger.logCronActivity('CRON_START', 'Starting Fastwork automatic job fetching system', {
            schedule: 'Every 5 minutes',
            categories: ['Application Development', 'Web Development', 'IT Solutions', 'IoT Work'],
            budgetFilter: '≥ 5,000 THB',
            timezone: 'Asia/Bangkok'
        });

        console.log('🤖 Fastwork Cron Job - Starting automatic job fetching');
        console.log('⏰ Schedule: Every 5 minutes');
        console.log('📂 Categories: 4 (App Dev, Web Dev, IT Solutions, IoT)');
        console.log('💰 Filter: Budget ≥ 5,000 THB');
        console.log('🔄 Press Ctrl+C to stop\n');

        // Run immediately on start
        this.fetchJobs();

        // Schedule to run every 5 minutes
        const task = cron.schedule('*/5 * * * *', () => {
            this.fetchJobs();
        }, {
            scheduled: true,
            timezone: 'Asia/Bangkok' // Fastwork is Thailand-based
        });

        // Print status every 15 minutes
        cron.schedule('*/15 * * * *', () => {
            this.printStatus();
        }, {
            scheduled: true,
            timezone: 'Asia/Bangkok'
        });

        console.log('✅ Cron job started successfully');
        console.log('💡 Run `npm run server` in another terminal to view jobs in Kanban board');
        
        // Keep the process running
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Stopping cron job...');
            task.stop();
            this.printStatus();
            console.log('👋 Goodbye!');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n\n🛑 Received SIGTERM, stopping cron job...');
            task.stop();
            process.exit(0);
        });

        // Print initial status after 1 minute
        setTimeout(() => {
            this.printStatus();
        }, 60000);
    }
}

async function main() {
    const cronJob = new FastworkCronJob();
    
    const initialized = await cronJob.initialize();
    if (!initialized) {
        console.error('Failed to initialize cron job');
        process.exit(1);
    }
    
    cronJob.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { FastworkCronJob };