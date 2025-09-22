import axios from 'axios';
import { getDatabase } from '../database/init.js';

export class NotificationService {
    constructor(config = {}) {
        this.facebook = {
            accessToken: config.facebookAccessToken,
            groupId: config.facebookGroupId
        };
        
        this.telegram = {
            botToken: config.telegramBotToken,
            chatId: config.telegramChatId
        };
    }

    async notifyNewJobs(jobs) {
        const results = [];
        
        for (const job of jobs) {
            try {
                const facebookResult = await this.sendToFacebook(job);
                const telegramResult = await this.sendToTelegram(job);
                
                results.push({
                    jobId: job.id,
                    facebook: facebookResult,
                    telegram: telegramResult
                });
                
                await this.updateJobStatus(job.id, 'notified');
            } catch (error) {
                console.error(`Error notifying job ${job.id}:`, error.message);
                results.push({
                    jobId: job.id,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    async sendToFacebook(job) {
        if (!this.facebook.accessToken || !this.facebook.groupId) {
            console.log('Facebook notification skipped - credentials not configured');
            return { success: false, reason: 'Not configured' };
        }

        try {
            const message = this.formatJobMessage(job, 'facebook');
            
            const response = await axios.post(
                `https://graph.facebook.com/v18.0/${this.facebook.groupId}/feed`,
                {
                    message: message,
                    access_token: this.facebook.accessToken
                }
            );

            await this.logNotification(job.id, 'facebook', 'sent');
            
            return {
                success: true,
                postId: response.data.id
            };
        } catch (error) {
            await this.logNotification(job.id, 'facebook', 'failed', error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendToTelegram(job) {
        if (!this.telegram.botToken || !this.telegram.chatId) {
            console.log('Telegram notification skipped - credentials not configured');
            return { success: false, reason: 'Not configured' };
        }

        try {
            const message = this.formatJobMessage(job, 'telegram');
            
            const response = await axios.post(
                `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`,
                {
                    chat_id: this.telegram.chatId,
                    text: message,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: false
                }
            );

            await this.logNotification(job.id, 'telegram', 'sent');
            
            return {
                success: true,
                messageId: response.data.result.message_id
            };
        } catch (error) {
            await this.logNotification(job.id, 'telegram', 'failed', error.message);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatJobMessage(job, platform) {
        const baseMessage = `
🔥 **New High-Value Job Alert!**

**${job.title}**
💰 Budget: ${job.budget.toLocaleString()} THB

📋 **Analysis:**
${job.analysis || 'Analysis pending...'}

🔗 View full details: ${job.url}

#FastworkJobs #Freelance #HighBudget
        `.trim();

        if (platform === 'telegram') {
            return baseMessage.replace(/\*\*(.*?)\*\*/g, '*$1*');
        }
        
        return baseMessage.replace(/\*\*(.*?)\*\*/g, '$1');
    }

    async logNotification(jobId, platform, status, errorMessage = null) {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO notifications (job_id, platform, status, sent_at, error_message)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const sentAt = status === 'sent' ? new Date().toISOString() : null;
            
            db.run(sql, [jobId, platform, status, sentAt, errorMessage], function(err) {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateJobStatus(jobId, status) {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE jobs SET status = ? WHERE id = ?';
            
            db.run(sql, [status, jobId], function(err) {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }
}