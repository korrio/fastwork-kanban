import { getDatabase } from '../database/init.js';
import { FastworkAPI, JOB_CATEGORIES } from '../api/fastwork.js';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/settings.js';
import { GitHubProjectsService } from './githubProjects.js';

export class JobProcessor {
    constructor() {
        this.fastworkAPI = new FastworkAPI();
        this.minBudget = CONFIG.budget.minimum;
        this.enabledCategories = CONFIG.categories.enabled.map(categoryName => 
            JOB_CATEGORIES[categoryName].id
        );
        
        // Initialize GitHub Projects service if enabled
        this.githubService = null;
        if (CONFIG.github.enabled) {
            this.githubService = new GitHubProjectsService(
                CONFIG.github.token,
                CONFIG.github.projectUrl
            );
        }
    }

    async processJobs(limit = 5, categories = null) {
        const db = getDatabase();
        const startTime = Date.now();
        
        try {
            const categoriesToFetch = categories || this.enabledCategories;
            const allJobs = [];

            // Log processing start
            logger.logJobProcessing('PROCESS_JOBS_START', 0, categoriesToFetch.length, null, {
                limit,
                minBudget: this.minBudget,
                categories: categoriesToFetch.map(id => FastworkAPI.getCategoryName(id))
            });

            // Fetch more jobs per category to account for budget filtering
            const jobsPerCategory = Math.ceil(limit / categoriesToFetch.length) + 10; // Extra buffer for filtering
            
            for (const categoryId of categoriesToFetch) {
                const categoryStartTime = Date.now();
                const categoryName = FastworkAPI.getCategoryName(categoryId);
                
                const result = await this.fastworkAPI.fetchJobs({ 
                    pageSize: Math.max(jobsPerCategory, 20), // At least 20 jobs per category
                    tagIds: [categoryId] 
                });
                
                if (result.success) {
                    const jobsWithCategory = result.jobs.map(job => ({
                        ...job,
                        category: categoryName,
                        tag_id: categoryId
                    }));
                    allJobs.push(...jobsWithCategory);

                    const categoryDuration = Date.now() - categoryStartTime;
                    logger.logJobProcessing('CATEGORY_PROCESSED', result.jobs.length, null, categoryDuration, {
                        category: categoryName,
                        pageSize: Math.max(jobsPerCategory, 20)
                    });
                } else {
                    logger.logError('JobProcessor.processJobs', new Error(`Failed to fetch category: ${categoryName}`), {
                        categoryId,
                        categoryName
                    });
                }
            }

            const eligibleJobs = this.filterJobsByBudget(allJobs);
            
            // Log budget filtering results
            const budgetCounts = allJobs.reduce((acc, job) => {
                const budget = this.extractBudget(job);
                if (budget >= this.minBudget) acc.high++;
                else if (budget > 0) acc.low++;
                else acc.none++;
                return acc;
            }, { high: 0, low: 0, none: 0 });
            
            logger.logJobProcessing('BUDGET_FILTERING', eligibleJobs.length, null, null, {
                totalFetched: allJobs.length,
                afterFiltering: eligibleJobs.length,
                budgetBreakdown: budgetCounts,
                minBudget: this.minBudget
            });
            
            // If we don't have enough eligible jobs, try to get more
            if (eligibleJobs.length < limit && allJobs.length > 0) {
                logger.logJobProcessing('INSUFFICIENT_ELIGIBLE_JOBS', eligibleJobs.length, null, null, {
                    requested: limit,
                    totalFetched: allJobs.length,
                    eligible: eligibleJobs.length,
                    shortfall: limit - eligibleJobs.length
                });
            }
            const jobsToProcess = eligibleJobs.slice(0, limit);

            logger.logJobProcessing('JOBS_TO_SAVE', jobsToProcess.length, categoriesToFetch.length, null, {
                totalEligible: eligibleJobs.length,
                processLimit: limit
            });

            // Save jobs to database and GitHub Projects
            let savedCount = 0;
            let githubCount = 0;
            
            // Initialize GitHub service if needed
            if (this.githubService && CONFIG.github.syncOnFetch) {
                const initialized = await this.githubService.initialize();
                if (!initialized) {
                    logger.logError('JobProcessor.processJobs', new Error('Failed to initialize GitHub service'), {});
                }
            }
            
            for (const job of jobsToProcess) {
                try {
                    await this.saveJob(db, job);
                    savedCount++;
                    
                    // Save to GitHub Projects if enabled
                    if (this.githubService && CONFIG.github.syncOnFetch) {
                        const githubResult = await this.saveJobToGitHub(job);
                        if (githubResult.success) {
                            githubCount++;
                        }
                    }
                } catch (error) {
                    logger.logError('JobProcessor.saveJob', error, { jobId: job.id, jobTitle: job.title });
                }
            }
            const totalDuration = Date.now() - startTime;

            logger.logJobProcessing('PROCESS_JOBS_COMPLETE', savedCount, categoriesToFetch.length, totalDuration, {
                totalFetched: allJobs.length,
                eligible: eligibleJobs.length,
                saved: savedCount,
                githubSynced: githubCount,
                budgetBreakdown: budgetCounts
            });

            return jobsToProcess;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            logger.logError('JobProcessor.processJobs', error, {
                duration: totalDuration,
                limit,
                categoriesCount: categories?.length || this.enabledCategories.length
            });
            throw error;
        } finally {
            db.close();
        }
    }

    filterJobsByBudget(jobs) {
        // If minBudget is 0, return all jobs (no filtering)
        if (this.minBudget === 0) {
            return jobs;
        }
        
        return jobs.filter(job => {
            const budget = this.extractBudget(job);
            return budget >= this.minBudget;
        });
    }

    extractBudget(job) {
        if (job.budget && typeof job.budget === 'number') {
            return job.budget;
        }
        
        if (job.budget_min && typeof job.budget_min === 'number') {
            return job.budget_min;
        }
        
        if (job.price && typeof job.price === 'number') {
            return job.price;
        }

        const budgetText = job.budget_text || job.description || '';
        const budgetMatch = budgetText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:บาท|THB|baht)/i);
        
        if (budgetMatch) {
            return parseInt(budgetMatch[1].replace(/,/g, ''));
        }

        return 0;
    }

    async saveJob(db, job) {
        return new Promise((resolve, reject) => {
            const jobData = {
                id: job.id,
                title: job.title || job.name,
                description: job.description,
                budget: this.extractBudget(job),
                currency: 'THB',
                tag_id: job.tag_id,
                created_at: job.created_at,
                inserted_at: job.inserted_at,
                url: FastworkAPI.generateJobUrl(job.id),
                raw_data: JSON.stringify(job),
                status: 'pending',
                kanban_status: 'jobs',
                category: job.category || 'Other',
                notes: '',
                priority: 0
            };

            const sql = `
                INSERT OR REPLACE INTO jobs 
                (id, title, description, budget, currency, tag_id, created_at, inserted_at, url, raw_data, status, kanban_status, category, notes, priority, github_synced, github_project_item_id, github_synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                jobData.id,
                jobData.title,
                jobData.description,
                jobData.budget,
                jobData.currency,
                jobData.tag_id,
                jobData.created_at,
                jobData.inserted_at,
                jobData.url,
                jobData.raw_data,
                jobData.status,
                jobData.kanban_status,
                jobData.category,
                jobData.notes,
                jobData.priority,
                jobData.github_synced || 0,
                jobData.github_project_item_id || null,
                jobData.github_synced_at || null
            ];

            db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Saved job: ${jobData.title} (Budget: ${jobData.budget} THB)`);
                    resolve(this.lastID);
                }
            });
        });
    }

    async saveJobToGitHub(job) {
        try {
            if (!this.githubService) {
                return { success: false, error: 'GitHub service not initialized' };
            }

            // Check if job is already synced to GitHub
            const isAlreadySynced = await this.isJobSyncedToGitHub(job.id);
            if (isAlreadySynced) {
                logger.logInfo('JobProcessor.saveJobToGitHub', 'Job already synced to GitHub, skipping', {
                    jobId: job.id,
                    jobTitle: job.title
                });
                return { success: true, skipped: true, reason: 'Already synced' };
            }

            const result = await this.githubService.createDraftIssue(job);
            
            if (result.success) {
                // Update database to mark as synced
                await this.markJobAsSynced(job.id, result.projectItemId);
                
                logger.logInfo('JobProcessor.saveJobToGitHub', 'Job saved to GitHub Projects', {
                    jobId: job.id,
                    jobTitle: job.title,
                    projectItemId: result.projectItemId
                });
            }
            
            return result;
        } catch (error) {
            logger.logError('JobProcessor.saveJobToGitHub', error, {
                jobId: job.id,
                jobTitle: job.title
            });
            
            return { success: false, error: error.message };
        }
    }

    async isJobSyncedToGitHub(jobId) {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT github_synced, github_project_item_id FROM jobs WHERE id = ?';
            
            db.get(sql, [jobId], (err, row) => {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(row && row.github_synced === 1 && row.github_project_item_id);
                }
            });
        });
    }

    async markJobAsSynced(jobId, projectItemId) {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE jobs 
                SET github_synced = 1, 
                    github_project_item_id = ?, 
                    github_synced_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.run(sql, [projectItemId, jobId], function(err) {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getUnanalyzedJobs() {
        const db = getDatabase();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM jobs WHERE status = ? AND budget >= ? ORDER BY created_at DESC';
            
            db.all(sql, ['pending', this.minBudget], (err, rows) => {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}