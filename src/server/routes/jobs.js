import express from 'express';
import { getDatabase } from '../../database/init.js';
import { JobProcessor } from '../../services/jobProcessor.js';
import { ClaudeAnalyzer } from '../../services/claudeAnalyzer.js';
import { JOB_CATEGORIES } from '../../api/fastwork.js';
import { GitHubProjectsService } from '../../services/githubProjects.js';
import { CONFIG } from '../../config/settings.js';

const router = express.Router();

// Get all jobs with optional filtering
router.get('/', async (req, res) => {
    try {
        const { 
            kanban_status, 
            category, 
            status, 
            limit = 100, 
            offset = 0 
        } = req.query;
        
        const db = getDatabase();
        let sql = 'SELECT * FROM jobs WHERE 1=1';
        const params = [];

        if (kanban_status) {
            sql += ' AND kanban_status = ?';
            params.push(kanban_status);
        }

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const jobs = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        db.close();
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get job by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const job = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        db.close();

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job);
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update job kanban status
router.patch('/:id/kanban-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { kanban_status } = req.body;

        if (!['jobs', 'interested', 'proposed', 'archived'].includes(kanban_status)) {
            return res.status(400).json({ error: 'Invalid kanban status' });
        }

        const db = getDatabase();

        const result = await new Promise((resolve, reject) => {
            db.run(
                'UPDATE jobs SET kanban_status = ? WHERE id = ?',
                [kanban_status, id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        db.close();

        if (result === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ message: 'Job status updated successfully' });
    } catch (error) {
        console.error('Error updating job status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update job notes
router.patch('/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const db = getDatabase();

        const result = await new Promise((resolve, reject) => {
            db.run(
                'UPDATE jobs SET notes = ? WHERE id = ?',
                [notes, id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        db.close();

        if (result === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ message: 'Job notes updated successfully' });
    } catch (error) {
        console.error('Error updating job notes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fetch fresh jobs from Fastwork API
router.post('/fetch', async (req, res) => {
    try {
        const { categories, limit = 20, minBudget } = req.body;
        
        const jobProcessor = new JobProcessor();
        
        // Temporarily adjust budget filter if specified
        if (minBudget !== undefined) {
            jobProcessor.minBudget = minBudget;
        }
        
        const categoriesToFetch = categories || [
            JOB_CATEGORIES.APPLICATION_DEVELOPMENT.id,
            JOB_CATEGORIES.WEB_DEVELOPMENT.id,
            JOB_CATEGORIES.IT_SOLUTIONS.id,
            JOB_CATEGORIES.IOT_WORK.id
        ];

        const processedJobs = await jobProcessor.processJobs(limit, categoriesToFetch);
        
        res.json({
            message: `Successfully fetched ${processedJobs.length} jobs`,
            jobs: processedJobs,
            categories: categoriesToFetch.length
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Analyze jobs with Claude
router.post('/analyze', async (req, res) => {
    try {
        const claudeAnalyzer = new ClaudeAnalyzer(process.env.CLAUDE_API_KEY);
        const analyzedCount = await claudeAnalyzer.analyzeAllPendingJobs();
        
        res.json({
            message: `Successfully analyzed ${analyzedCount} jobs`,
            count: analyzedCount
        });
    } catch (error) {
        console.error('Error analyzing jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test GitHub Projects integration
router.post('/github/test', async (req, res) => {
    try {
        if (!CONFIG.github.enabled) {
            return res.status(400).json({ error: 'GitHub integration is disabled' });
        }

        const githubService = new GitHubProjectsService(
            CONFIG.github.token,
            CONFIG.github.projectUrl
        );

        const testResult = await githubService.testConnection();
        
        if (testResult.success) {
            const initResult = await githubService.initialize();
            res.json({
                message: 'GitHub Projects integration test successful',
                connection: testResult,
                initialized: initResult
            });
        } else {
            res.status(500).json({
                error: 'GitHub connection failed',
                details: testResult.error
            });
        }
    } catch (error) {
        console.error('Error testing GitHub integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// Sync existing jobs to GitHub Projects
router.post('/github/sync', async (req, res) => {
    try {
        if (!CONFIG.github.enabled) {
            return res.status(400).json({ error: 'GitHub integration is disabled' });
        }

        const { limit = 10 } = req.body;
        const db = getDatabase();

        // Get recent jobs that haven't been synced to GitHub yet
        const jobs = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM jobs WHERE github_synced != 1 OR github_synced IS NULL ORDER BY created_at DESC LIMIT ?',
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        db.close();

        const githubService = new GitHubProjectsService(
            CONFIG.github.token,
            CONFIG.github.projectUrl
        );

        const initialized = await githubService.initialize();
        if (!initialized) {
            return res.status(500).json({ error: 'Failed to initialize GitHub service' });
        }

        let syncedCount = 0;
        let skippedCount = 0;
        const results = [];

        // Use JobProcessor for consistency with automatic sync
        const jobProcessor = new JobProcessor();
        if (jobProcessor.githubService) {
            await jobProcessor.githubService.initialize();
        }

        for (const job of jobs) {
            try {
                const result = await jobProcessor.saveJobToGitHub(job);
                results.push({
                    jobId: job.id,
                    jobTitle: job.title,
                    success: result.success,
                    skipped: result.skipped,
                    projectItemId: result.projectItemId,
                    error: result.error,
                    reason: result.reason
                });
                
                if (result.success && !result.skipped) {
                    syncedCount++;
                } else if (result.skipped) {
                    skippedCount++;
                }
            } catch (error) {
                results.push({
                    jobId: job.id,
                    jobTitle: job.title,
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({
            message: `Synced ${syncedCount} new jobs, skipped ${skippedCount} duplicates out of ${jobs.length} eligible jobs`,
            syncedCount,
            skippedCount,
            totalJobs: jobs.length,
            results
        });
    } catch (error) {
        console.error('Error syncing jobs to GitHub:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get GitHub sync statistics
router.get('/github/stats', async (req, res) => {
    try {
        const db = getDatabase();

        const stats = await new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as total FROM jobs',
                'SELECT COUNT(*) as synced FROM jobs WHERE github_synced = 1',
                'SELECT COUNT(*) as unsynced FROM jobs WHERE github_synced != 1 OR github_synced IS NULL'
            ];

            let results = { total: 0, synced: 0, unsynced: 0 };
            let completed = 0;

            // Total count
            db.get(queries[0], (err, row) => {
                if (err) reject(err);
                else {
                    results.total = row.total;
                    completed++;
                    if (completed === 3) resolve(results);
                }
            });

            // Synced count
            db.get(queries[1], (err, row) => {
                if (err) reject(err);
                else {
                    results.synced = row.synced;
                    completed++;
                    if (completed === 3) resolve(results);
                }
            });

            // Unsynced count
            db.get(queries[2], (err, row) => {
                if (err) reject(err);
                else {
                    results.unsynced = row.unsynced;
                    completed++;
                    if (completed === 3) resolve(results);
                }
            });
        });

        db.close();
        res.json({
            ...stats,
            syncPercentage: stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 0
        });
    } catch (error) {
        console.error('Error fetching GitHub sync stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get job statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const db = getDatabase();

        const stats = await new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as total FROM jobs',
                'SELECT kanban_status, COUNT(*) as count FROM jobs GROUP BY kanban_status',
                'SELECT category, COUNT(*) as count FROM jobs GROUP BY category',
                'SELECT AVG(budget) as avg_budget FROM jobs WHERE budget > 0'
            ];

            let results = { total: 0, byStatus: {}, byCategory: {}, avgBudget: 0 };
            let completed = 0;

            // Total count
            db.get(queries[0], (err, row) => {
                if (err) reject(err);
                else {
                    results.total = row.total;
                    completed++;
                    if (completed === 4) resolve(results);
                }
            });

            // By status
            db.all(queries[1], (err, rows) => {
                if (err) reject(err);
                else {
                    results.byStatus = rows.reduce((acc, row) => {
                        acc[row.kanban_status] = row.count;
                        return acc;
                    }, {});
                    completed++;
                    if (completed === 4) resolve(results);
                }
            });

            // By category
            db.all(queries[2], (err, rows) => {
                if (err) reject(err);
                else {
                    results.byCategory = rows.reduce((acc, row) => {
                        acc[row.category] = row.count;
                        return acc;
                    }, {});
                    completed++;
                    if (completed === 4) resolve(results);
                }
            });

            // Average budget
            db.get(queries[3], (err, row) => {
                if (err) reject(err);
                else {
                    results.avgBudget = Math.round(row.avg_budget || 0);
                    completed++;
                    if (completed === 4) resolve(results);
                }
            });
        });

        db.close();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export { router as jobsRouter };