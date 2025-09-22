import axios from 'axios';
import { getDatabase } from '../database/init.js';

export class ClaudeAnalyzer {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = axios.create({
            baseURL: 'https://api.anthropic.com/v1',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            timeout: 30000
        });
    }

    async analyzeJob(job) {
        if (!this.apiKey) {
            throw new Error('Claude API key not configured');
        }

        const prompt = this.buildAnalysisPrompt(job);
        
        try {
            const response = await this.client.post('/messages', {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            const analysis = response.data.content[0].text;
            await this.saveAnalysis(job.id, analysis);
            
            return {
                success: true,
                analysis: analysis
            };
        } catch (error) {
            console.error(`Error analyzing job ${job.id}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    buildAnalysisPrompt(job) {
        return `Please analyze this job posting from Fastwork.co and provide a concise summary:

**Job Title:** ${job.title}
**Budget:** ${job.budget} THB
**Description:** ${job.description}

Please provide:
1. A brief summary of what the job entails
2. Key requirements or skills needed
3. Assessment of the project scope and complexity
4. Any red flags or concerns
5. Overall recommendation (Good opportunity / Proceed with caution / Avoid)

Keep the analysis under 200 words and focus on actionable insights for freelancers.`;
    }

    async saveAnalysis(jobId, analysis) {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE jobs SET analysis = ?, status = ? WHERE id = ?';
            
            db.run(sql, [analysis, 'analyzed', jobId], function(err) {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    console.log(`Analysis saved for job ${jobId}`);
                    resolve(this.changes);
                }
            });
        });
    }

    async getAnalyzedJobs() {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM jobs WHERE status = ? ORDER BY processed_at DESC';
            
            db.all(sql, ['analyzed'], (err, rows) => {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async analyzeAllPendingJobs() {
        const db = getDatabase();
        
        try {
            const pendingJobs = await new Promise((resolve, reject) => {
                const sql = 'SELECT * FROM jobs WHERE status = ? AND budget >= ? ORDER BY created_at DESC';
                
                db.all(sql, ['pending', 10000], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            console.log(`Found ${pendingJobs.length} pending jobs to analyze`);

            for (const job of pendingJobs) {
                try {
                    const parsedJob = {
                        ...job,
                        raw_data: JSON.parse(job.raw_data)
                    };
                    
                    const result = await this.analyzeJob(parsedJob);
                    
                    if (result.success) {
                        console.log(`✅ Analyzed: ${job.title}`);
                    } else {
                        console.error(`❌ Failed to analyze: ${job.title} - ${result.error}`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Error processing job ${job.id}:`, error.message);
                }
            }

            return pendingJobs.length;
        } finally {
            db.close();
        }
    }
}