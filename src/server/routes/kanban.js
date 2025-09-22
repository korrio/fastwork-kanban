import express from 'express';
import { getDatabase } from '../../database/init.js';
import { CONFIG } from '../../config/settings.js';

const router = express.Router();

// Get kanban board data (jobs grouped by status)
router.get('/board', async (req, res) => {
    try {
        const db = getDatabase();

        const kanbanData = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    id, title, description, budget, category, 
                    kanban_status, notes, priority, created_at, 
                    url, analysis
                FROM jobs 
                WHERE budget >= ?
                ORDER BY 
                    CASE kanban_status 
                        WHEN 'jobs' THEN 1 
                        WHEN 'interested' THEN 2 
                        WHEN 'proposed' THEN 3 
                        WHEN 'archived' THEN 4 
                    END,
                    priority DESC,
                    created_at DESC
            `;

            db.all(sql, [CONFIG.budget.minimum], (err, rows) => {
                if (err) reject(err);
                else {
                    // Group jobs by kanban status
                    const grouped = {
                        jobs: [],
                        interested: [],
                        proposed: [],
                        archived: []
                    };

                    rows.forEach(job => {
                        if (grouped[job.kanban_status]) {
                            grouped[job.kanban_status].push(job);
                        }
                    });

                    resolve(grouped);
                }
            });
        });

        db.close();
        res.json(kanbanData);
    } catch (error) {
        console.error('Error fetching kanban board:', error);
        res.status(500).json({ error: error.message });
    }
});

// Move job between kanban columns
router.post('/move', async (req, res) => {
    try {
        const { jobId, fromStatus, toStatus, newIndex } = req.body;

        if (!['jobs', 'interested', 'proposed', 'archived'].includes(toStatus)) {
            return res.status(400).json({ error: 'Invalid kanban status' });
        }

        const db = getDatabase();

        // Update the job's kanban status
        const result = await new Promise((resolve, reject) => {
            db.run(
                'UPDATE jobs SET kanban_status = ? WHERE id = ?',
                [toStatus, jobId],
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

        res.json({ 
            message: 'Job moved successfully',
            jobId,
            fromStatus,
            toStatus
        });
    } catch (error) {
        console.error('Error moving job:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update job priority
router.patch('/priority', async (req, res) => {
    try {
        const { jobId, priority } = req.body;

        if (typeof priority !== 'number') {
            return res.status(400).json({ error: 'Priority must be a number' });
        }

        const db = getDatabase();

        const result = await new Promise((resolve, reject) => {
            db.run(
                'UPDATE jobs SET priority = ? WHERE id = ?',
                [priority, jobId],
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

        res.json({ message: 'Job priority updated successfully' });
    } catch (error) {
        console.error('Error updating job priority:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get column statistics
router.get('/stats', async (req, res) => {
    try {
        const db = getDatabase();

        const stats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    kanban_status,
                    COUNT(*) as count,
                    AVG(budget) as avg_budget,
                    MIN(budget) as min_budget,
                    MAX(budget) as max_budget
                FROM jobs 
                WHERE budget >= ?
                GROUP BY kanban_status
            `;

            db.all(sql, [CONFIG.budget.minimum], (err, rows) => {
                if (err) reject(err);
                else {
                    const stats = rows.reduce((acc, row) => {
                        acc[row.kanban_status] = {
                            count: row.count,
                            avgBudget: Math.round(row.avg_budget || 0),
                            minBudget: row.min_budget || 0,
                            maxBudget: row.max_budget || 0
                        };
                        return acc;
                    }, {});
                    resolve(stats);
                }
            });
        });

        db.close();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching kanban stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export { router as kanbanRouter };