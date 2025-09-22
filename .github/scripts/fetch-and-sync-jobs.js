#!/usr/bin/env node

/**
 * GitHub Actions script to fetch jobs from Fastwork API and sync to GitHub Projects
 */

import axios from 'axios';
import { writeFileSync } from 'fs';

// Configuration from environment variables
const CONFIG = {
    github: {
        token: process.env.GITHUB_PROJECT_TOKEN || process.env.GITHUB_TOKEN,
        projectUrl: process.env.GITHUB_PROJECT_URL || 'https://github.com/users/korrio/projects/4',
        issuesRepo: process.env.GITHUB_ISSUES_REPO || 'korrio/fastwork-kanban',
        apiBase: 'https://api.github.com/graphql'
    },
    fastwork: {
        apiBase: process.env.FASTWORK_API_BASE || 'https://jobboard-api.fastwork.co/api',
        categories: [
            'c82d3ff0-c1c1-4b39-b9e3-124e513eb66c', // Application Development
            '4c7ee9da-5509-4ff1-b7c2-df81fb2ef06c', // Web Development  
            '2a0001e2-d5d9-4fb8-92da-f4a805c47044', // IT Solutions
            '9f240bc1-fde2-4217-a5f5-f6fc02ba3f54'  // IoT Work
        ]
    },
    sync: {
        jobLimit: parseInt(process.env.JOB_LIMIT) || 20,
        minBudget: parseInt(process.env.MIN_BUDGET) || 5000
    }
};

// Category name mapping
const CATEGORY_NAMES = {
    'c82d3ff0-c1c1-4b39-b9e3-124e513eb66c': 'Application Development',
    '4c7ee9da-5509-4ff1-b7c2-df81fb2ef06c': 'Web Development',
    '2a0001e2-d5d9-4fb8-92da-f4a805c47044': 'IT Solutions',
    '9f240bc1-fde2-4217-a5f5-f6fc02ba3f54': 'IoT Work'
};

class FastworkGitHubSync {
    constructor() {
        this.projectNodeId = null;
        this.syncedJobs = new Set(); // Track synced jobs in this run
        this.summary = {
            totalFetched: 0,
            totalSynced: 0,
            totalSkipped: 0,
            errors: 0,
            recentJobs: []
        };
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...data
        };
        
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        if (Object.keys(data).length > 0) {
            console.log(JSON.stringify(data, null, 2));
        }
        
        // Write to log file
        const logLine = JSON.stringify(logEntry) + '\n';
        writeFileSync('logs/github-actions.log', logLine, { flag: 'a' });
    }

    async initializeProject() {
        try {
            // Parse project URL to get owner and project number
            const urlMatch = CONFIG.github.projectUrl.match(/github\.com\/users\/([^\/]+)\/projects\/(\d+)/);
            if (!urlMatch) {
                throw new Error('Invalid GitHub project URL format');
            }

            const owner = urlMatch[1];
            const projectNumber = parseInt(urlMatch[2]);

            // Get project details via GraphQL
            const query = `
                query($owner: String!, $projectNumber: Int!) {
                    user(login: $owner) {
                        projectV2(number: $projectNumber) {
                            id
                            title
                        }
                    }
                }
            `;

            const response = await this.makeGraphQLRequest(query, { owner, projectNumber });
            
            if (!response.data.user?.projectV2) {
                throw new Error(`Project not found: ${CONFIG.github.projectUrl}`);
            }

            this.projectNodeId = response.data.user.projectV2.id;
            
            this.log('info', 'GitHub project initialized', {
                projectId: this.projectNodeId,
                projectTitle: response.data.user.projectV2.title,
                owner,
                projectNumber
            });

            return true;
        } catch (error) {
            this.log('error', 'Failed to initialize GitHub project', { error: error.message });
            return false;
        }
    }

    async fetchJobsFromFastwork() {
        const allJobs = [];
        
        try {
            for (const categoryId of CONFIG.fastwork.categories) {
                const categoryName = CATEGORY_NAMES[categoryId] || 'Unknown';
                
                this.log('info', `Fetching jobs for category: ${categoryName}`, { categoryId });
                
                const url = `${CONFIG.fastwork.apiBase}/jobs`;
                const params = {
                    page: 1,
                    page_size: 20,
                    'order_by[]': 'inserted_at',
                    'order_directions[]': 'desc',
                    'filters[0][field]': 'tag_id',
                    'filters[0][value]': categoryId
                };

                const response = await axios.get(url, { params });
                
                if (response.data && response.data.data) {
                    const jobs = response.data.data.map(job => ({
                        ...job,
                        category: categoryName,
                        tag_id: categoryId
                    }));
                    
                    allJobs.push(...jobs);
                    
                    this.log('info', `Fetched ${jobs.length} jobs from ${categoryName}`, {
                        categoryId,
                        jobCount: jobs.length
                    });
                }
            }

            // Filter jobs by budget
            const eligibleJobs = allJobs.filter(job => {
                const budget = this.extractBudget(job);
                return budget >= CONFIG.sync.minBudget;
            });

            this.summary.totalFetched = eligibleJobs.length;
            
            this.log('info', 'Job fetching completed', {
                totalJobs: allJobs.length,
                eligibleJobs: eligibleJobs.length,
                minBudget: CONFIG.sync.minBudget
            });

            return eligibleJobs.slice(0, CONFIG.sync.jobLimit);
            
        } catch (error) {
            this.log('error', 'Failed to fetch jobs from Fastwork', { error: error.message });
            this.summary.errors++;
            return [];
        }
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

        // Try to parse budget from text
        const budgetText = job.budget_text || job.description || '';
        const budgetMatch = budgetText.match(/(\\d{1,3}(?:,\\d{3})*)\\s*(?:บาท|THB|baht)/i);
        
        if (budgetMatch) {
            return parseInt(budgetMatch[1].replace(/,/g, ''));
        }

        return 0;
    }

    calculateSize(budget) {
        if (!budget || budget === 0) return 'XS';
        if (budget < 5000) return 'XS';
        if (budget < 15000) return 'S';
        if (budget < 30000) return 'M';
        if (budget < 60000) return 'L';
        return 'XL';
    }

    formatDateForGitHub(dateString) {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return null;
            return date.toISOString().split('T')[0];
        } catch (error) {
            return null;
        }
    }

    extractEndDate(job) {
        try {
            if (job.deadline_at) {
                return this.formatDateForGitHub(job.deadline_at);
            }
            
            if (job.expired_at) {
                return this.formatDateForGitHub(job.expired_at);
            }
            
            // Fallback: 30 days from insertion
            if (job.inserted_at) {
                const insertDate = new Date(job.inserted_at);
                insertDate.setDate(insertDate.getDate() + 30);
                return this.formatDateForGitHub(insertDate.toISOString());
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    generateTags(job) {
        const tags = [];
        
        // Budget-based tags
        const budget = this.extractBudget(job);
        if (budget >= 50000) tags.push('high-budget');
        else if (budget >= 20000) tags.push('medium-budget');
        else if (budget > 0) tags.push('low-budget');
        else tags.push('no-budget');

        // Category tag
        if (job.category) {
            const categoryTag = job.category.toLowerCase()
                .replace(/\\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            tags.push(categoryTag);
        }

        // Content-based tags
        const content = `${job.title || ''} ${job.description || ''}`.toLowerCase();
        if (content.includes('urgent') || content.includes('ด่วน')) tags.push('urgent');
        if (content.includes('remote') || content.includes('wfh')) tags.push('remote');
        if (content.includes('full time') || content.includes('full-time')) tags.push('full-time');

        return tags;
    }

    formatJobTitle(job) {
        const budget = this.extractBudget(job);
        const budgetStr = budget ? `[${budget.toLocaleString()} THB] ` : '';
        return `${budgetStr}${job.title}`;
    }

    formatJobDescription(job) {
        const budget = this.extractBudget(job);
        const size = this.calculateSize(budget);
        const startDate = this.formatDateForGitHub(job.inserted_at);
        const endDate = this.extractEndDate(job);
        const tags = this.generateTags(job);
        
        const sections = [
            `## Job Details`,
            `**Title:** ${job.title}`,
            `**Budget:** ${budget ? `${budget.toLocaleString()} THB` : 'Not specified'}`,
            `**Size:** ${size}`,
            `**Category:** ${job.category || 'Other'}`,
            `**Start Date:** ${startDate || 'Not specified'}`,
            `**End Date:** ${endDate || 'Not specified'}`,
            `**Fastwork URL:** [View Job](https://jobboard.fastwork.co/jobs/${job.id})`,
            ``,
            `## Description`,
            job.description || 'No description provided',
            ``,
            `## Additional Information`,
            `- **Job ID:** ${job.id}`,
            `- **Created:** ${job.inserted_at ? new Date(job.inserted_at).toLocaleDateString() : 'Unknown'}`,
            `- **Source:** Fastwork.co`,
            `- **Sync:** GitHub Actions`,
            ``
        ];

        if (tags.length > 0) {
            sections.push(`**Tags:** ${tags.map(tag => \`\${tag}\`).join(', ')}`);
        }

        return sections.join('\\n');
    }

    async createDraftIssue(job) {
        try {
            const title = this.formatJobTitle(job);
            const body = this.formatJobDescription(job);
            const budget = this.extractBudget(job);

            // For high budget jobs (>10,000 THB), create actual GitHub issues
            if (budget > 10000) {
                return await this.createGitHubIssue(job, title, body);
            }

            const mutation = `
                mutation($projectId: ID!, $title: String!, $body: String!) {
                    addProjectV2DraftIssue(
                        input: {
                            projectId: $projectId
                            title: $title
                            body: $body
                        }
                    ) {
                        projectItem {
                            id
                            type
                            content {
                                ... on DraftIssue {
                                    id
                                    title
                                    body
                                }
                            }
                        }
                    }
                }
            `;

            const response = await this.makeGraphQLRequest(mutation, {
                projectId: this.projectNodeId,
                title: title,
                body: body
            });

            if (response.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
            }

            const projectItem = response.data.addProjectV2DraftIssue.projectItem;
            
            this.log('info', 'Created draft issue in GitHub project', {
                jobId: job.id,
                jobTitle: job.title,
                projectItemId: projectItem.id,
                budget: budget
            });

            return {
                success: true,
                projectItemId: projectItem.id,
                draftIssueId: projectItem.content.id,
                type: 'draft'
            };

        } catch (error) {
            this.log('error', 'Failed to create draft issue', {
                jobId: job.id,
                jobTitle: job.title,
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createGitHubIssue(job, title, body) {
        try {
            // Parse repository from config
            const [owner, repo] = CONFIG.github.issuesRepo.split('/');
            const tags = this.generateTags(job);
            
            // Create GitHub issue using REST API
            const issueResponse = await axios.post(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                title: title,
                body: body,
                labels: [job.category, ...tags].filter(Boolean)
            }, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.github.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                }
            });

            const issue = issueResponse.data;
            
            // Add issue to project
            const addToProjectMutation = `
                mutation($projectId: ID!, $contentId: ID!) {
                    addProjectV2ItemByContentId(
                        input: {
                            projectId: $projectId
                            contentId: $contentId
                        }
                    ) {
                        item {
                            id
                        }
                    }
                }
            `;

            const projectResponse = await this.makeGraphQLRequest(addToProjectMutation, {
                projectId: this.projectNodeId,
                contentId: issue.node_id
            });

            this.log('info', 'Created GitHub issue and added to project', {
                jobId: job.id,
                jobTitle: job.title,
                issueNumber: issue.number,
                issueUrl: issue.html_url,
                projectItemId: projectResponse.data.addProjectV2ItemByContentId.item.id,
                budget: this.extractBudget(job),
                labels: [job.category, ...tags]
            });

            return {
                success: true,
                projectItemId: projectResponse.data.addProjectV2ItemByContentId.item.id,
                issueId: issue.id,
                issueNumber: issue.number,
                issueUrl: issue.html_url,
                type: 'issue'
            };

        } catch (error) {
            this.log('error', 'Failed to create GitHub issue', {
                jobId: job.id,
                jobTitle: job.title,
                error: error.message,
                budget: this.extractBudget(job)
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    async syncJobsToGitHub(jobs) {
        let syncedCount = 0;
        let skippedCount = 0;

        for (const job of jobs) {
            try {
                // Simple duplicate check based on job ID in this run
                if (this.syncedJobs.has(job.id)) {
                    this.log('info', 'Job already processed in this run, skipping', {
                        jobId: job.id,
                        jobTitle: job.title
                    });
                    skippedCount++;
                    continue;
                }

                const result = await this.createDraftIssue(job);
                
                if (result.success) {
                    syncedCount++;
                    this.syncedJobs.add(job.id);
                    
                    // Add to recent jobs for summary
                    this.summary.recentJobs.push({
                        title: job.title,
                        budget: this.extractBudget(job),
                        url: `https://jobboard.fastwork.co/jobs/${job.id}`
                    });
                    
                    this.log('info', `Successfully synced job to GitHub Projects as ${result.type || 'draft'}`, {
                        jobId: job.id,
                        jobTitle: job.title,
                        projectItemId: result.projectItemId,
                        issueNumber: result.issueNumber,
                        issueUrl: result.issueUrl,
                        type: result.type
                    });
                } else {
                    this.summary.errors++;
                }
                
                // Rate limiting: wait 500ms between requests
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                this.log('error', 'Error syncing job', {
                    jobId: job.id,
                    jobTitle: job.title,
                    error: error.message
                });
                this.summary.errors++;
            }
        }

        this.summary.totalSynced = syncedCount;
        this.summary.totalSkipped = skippedCount;

        this.log('info', 'Job sync completed', {
            totalJobs: jobs.length,
            syncedCount,
            skippedCount,
            errors: this.summary.errors
        });

        return { syncedCount, skippedCount };
    }

    async makeGraphQLRequest(query, variables = {}) {
        try {
            const response = await axios.post(CONFIG.github.apiBase, {
                query,
                variables
            }, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.github.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.data.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
            }

            return response.data;
        } catch (error) {
            this.log('error', 'GraphQL request failed', {
                error: error.message,
                query: query.substring(0, 100) + '...'
            });
            throw error;
        }
    }

    async run() {
        try {
            this.log('info', 'Starting Fastwork to GitHub Projects sync', {
                jobLimit: CONFIG.sync.jobLimit,
                minBudget: CONFIG.sync.minBudget,
                projectUrl: CONFIG.github.projectUrl
            });

            // Initialize GitHub project
            const initialized = await this.initializeProject();
            if (!initialized) {
                throw new Error('Failed to initialize GitHub project');
            }

            // Fetch jobs from Fastwork
            const jobs = await this.fetchJobsFromFastwork();
            if (jobs.length === 0) {
                this.log('info', 'No eligible jobs found to sync');
                return;
            }

            // Sync jobs to GitHub Projects
            await this.syncJobsToGitHub(jobs);

            // Write summary for GitHub Actions
            writeFileSync('sync-summary.json', JSON.stringify(this.summary, null, 2));

            this.log('info', 'Sync process completed successfully', this.summary);

        } catch (error) {
            this.log('error', 'Sync process failed', { error: error.message });
            this.summary.errors++;
            
            // Write error summary
            writeFileSync('sync-summary.json', JSON.stringify(this.summary, null, 2));
            
            process.exit(1);
        }
    }
}

// Run the sync process
const sync = new FastworkGitHubSync();
sync.run();