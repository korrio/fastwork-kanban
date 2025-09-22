import logger from '../utils/logger.js';
import { CONFIG } from '../config/settings.js';

export class GitHubProjectsService {
    constructor(token, projectUrl) {
        this.token = token;
        this.projectUrl = projectUrl;
        this.apiBase = 'https://api.github.com/graphql';
        
        // Parse project URL to extract owner and project number
        const urlMatch = projectUrl.match(/github\.com\/users\/([^\/]+)\/projects\/(\d+)/);
        if (urlMatch) {
            this.owner = urlMatch[1];
            this.projectNumber = parseInt(urlMatch[2]);
        } else {
            throw new Error('Invalid GitHub project URL format');
        }
        
        this.projectNodeId = null;
        this.fieldIds = {
            budget: null,
            category: null,
            tags: null,
            status: null,
            size: null,
            startDate: null,
            endDate: null
        };
    }

    async initialize() {
        try {
            // Get project node ID and field IDs
            await this.getProjectDetails();
            logger.logInfo('GitHubProjectsService.initialize', 'GitHub Projects service initialized successfully', {
                owner: this.owner,
                projectNumber: this.projectNumber,
                projectNodeId: this.projectNodeId
            });
            return true;
        } catch (error) {
            logger.logError('GitHubProjectsService.initialize', error, {
                owner: this.owner,
                projectNumber: this.projectNumber
            });
            return false;
        }
    }

    async getProjectDetails() {
        const query = `
            query($owner: String!, $projectNumber: Int!) {
                user(login: $owner) {
                    projectV2(number: $projectNumber) {
                        id
                        title
                        fields(first: 20) {
                            nodes {
                                ... on ProjectV2Field {
                                    id
                                    name
                                    dataType
                                }
                                ... on ProjectV2SingleSelectField {
                                    id
                                    name
                                    dataType
                                    options {
                                        id
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        const response = await this.makeGraphQLRequest(query, {
            owner: this.owner,
            projectNumber: this.projectNumber
        });

        if (!response.data.user?.projectV2) {
            throw new Error(`Project not found: ${this.projectUrl}`);
        }

        const project = response.data.user.projectV2;
        this.projectNodeId = project.id;

        // Map field names to IDs for commonly used fields
        project.fields.nodes.forEach(field => {
            const fieldName = field.name.toLowerCase();
            if (fieldName.includes('budget')) {
                this.fieldIds.budget = field.id;
            } else if (fieldName.includes('category')) {
                this.fieldIds.category = field.id;
            } else if (fieldName.includes('tag') || fieldName.includes('label')) {
                this.fieldIds.tags = field.id;
            } else if (fieldName.includes('status')) {
                this.fieldIds.status = field.id;
            } else if (fieldName.includes('size')) {
                this.fieldIds.size = field.id;
            } else if (fieldName.includes('start') && (fieldName.includes('date') || fieldName.includes('time'))) {
                this.fieldIds.startDate = field.id;
            } else if (fieldName.includes('end') && (fieldName.includes('date') || fieldName.includes('time'))) {
                this.fieldIds.endDate = field.id;
            } else if (fieldName.includes('deadline')) {
                this.fieldIds.endDate = field.id;
            }
        });

        logger.logInfo('GitHubProjectsService.getProjectDetails', 'Retrieved project details', {
            projectId: this.projectNodeId,
            projectTitle: project.title,
            fieldsFound: Object.keys(this.fieldIds).filter(key => this.fieldIds[key]).length
        });
    }

    async createDraftIssue(jobData) {
        try {
            const title = this.formatJobTitle(jobData);
            const body = this.formatJobDescription(jobData);
            const budget = jobData.budget || 0;

            // For high budget jobs (>10,000 THB), create actual GitHub issues
            if (budget > 10000) {
                return await this.createGitHubIssue(jobData, title, body);
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
            
            logger.logInfo('GitHubProjectsService.createDraftIssue', 'Created draft issue in GitHub project', {
                jobId: jobData.id,
                jobTitle: jobData.title,
                projectItemId: projectItem.id,
                projectUrl: this.projectUrl,
                budget: budget
            });

            // Update custom fields if available
            await this.updateProjectItemFields(projectItem.id, jobData);

            return {
                success: true,
                projectItemId: projectItem.id,
                draftIssueId: projectItem.content.id,
                type: 'draft'
            };

        } catch (error) {
            logger.logError('GitHubProjectsService.createDraftIssue', error, {
                jobId: jobData.id,
                jobTitle: jobData.title,
                projectUrl: this.projectUrl
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createGitHubIssue(jobData, title, body) {
        try {
            const tags = this.generateTags(jobData);
            
            // Parse repository from config
            const [owner, repo] = CONFIG.github.issuesRepo.split('/');
            
            // Create GitHub issue using REST API
            const issueResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: title,
                    body: body,
                    labels: [jobData.category, ...tags].filter(Boolean)
                })
            });

            if (!issueResponse.ok) {
                const errorText = await issueResponse.text();
                throw new Error(`Failed to create issue: HTTP ${issueResponse.status}: ${errorText}`);
            }

            const issue = await issueResponse.json();
            
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

            logger.logInfo('GitHubProjectsService.createGitHubIssue', 'Created GitHub issue and added to project', {
                jobId: jobData.id,
                jobTitle: jobData.title,
                issueNumber: issue.number,
                issueUrl: issue.html_url,
                projectItemId: projectResponse.data.addProjectV2ItemByContentId.item.id,
                budget: jobData.budget,
                labels: [jobData.category, ...tags]
            });

            // Update custom fields if available
            await this.updateProjectItemFields(projectResponse.data.addProjectV2ItemByContentId.item.id, jobData);

            return {
                success: true,
                projectItemId: projectResponse.data.addProjectV2ItemByContentId.item.id,
                issueId: issue.id,
                issueNumber: issue.number,
                issueUrl: issue.html_url,
                type: 'issue'
            };

        } catch (error) {
            logger.logError('GitHubProjectsService.createGitHubIssue', error, {
                jobId: jobData.id,
                jobTitle: jobData.title,
                budget: jobData.budget
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateProjectItemFields(projectItemId, jobData) {
        const updates = [];

        // Update budget field if exists
        if (this.fieldIds.budget && jobData.budget) {
            updates.push({
                fieldId: this.fieldIds.budget,
                value: `${jobData.budget} THB`,
                type: 'text'
            });
        }

        // Update category field if exists
        if (this.fieldIds.category && jobData.category) {
            updates.push({
                fieldId: this.fieldIds.category,
                value: jobData.category,
                type: 'text'
            });
        }

        // Update size field based on budget if exists
        if (this.fieldIds.size && jobData.budget) {
            const size = this.calculateSize(jobData.budget);
            updates.push({
                fieldId: this.fieldIds.size,
                value: size,
                type: 'singleSelect'
            });
        }

        // Update start date (use inserted_at as project start)
        if (this.fieldIds.startDate && jobData.inserted_at) {
            const startDate = this.formatDateForGitHub(jobData.inserted_at);
            if (startDate) {
                updates.push({
                    fieldId: this.fieldIds.startDate,
                    value: startDate,
                    type: 'date'
                });
            }
        }

        // Update end date (use deadline_at from raw_data)
        if (this.fieldIds.endDate) {
            const endDate = this.extractEndDate(jobData);
            if (endDate) {
                updates.push({
                    fieldId: this.fieldIds.endDate,
                    value: endDate,
                    type: 'date'
                });
            }
        }

        // Update tags field if exists
        if (this.fieldIds.tags) {
            const tags = this.generateTags(jobData);
            if (tags.length > 0) {
                updates.push({
                    fieldId: this.fieldIds.tags,
                    value: tags.join(', '),
                    type: 'text'
                });
            }
        }

        // Perform field updates
        for (const update of updates) {
            try {
                await this.updateProjectItemField(projectItemId, update.fieldId, update.value, update.type);
            } catch (error) {
                logger.logError('GitHubProjectsService.updateProjectItemFields', error, {
                    projectItemId,
                    fieldId: update.fieldId,
                    value: update.value,
                    type: update.type
                });
            }
        }
    }

    async updateProjectItemField(projectItemId, fieldId, value, type = 'text') {
        const mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
                updateProjectV2ItemFieldValue(
                    input: {
                        projectId: $projectId
                        itemId: $itemId
                        fieldId: $fieldId
                        value: $value
                    }
                ) {
                    projectV2Item {
                        id
                    }
                }
            }
        `;

        // Format value based on field type
        let fieldValue;
        switch (type) {
            case 'date':
                fieldValue = { date: value };
                break;
            case 'number':
                fieldValue = { number: parseFloat(value) };
                break;
            case 'singleSelect':
                fieldValue = { singleSelectOptionId: value };
                break;
            case 'text':
            default:
                fieldValue = { text: value };
                break;
        }

        return await this.makeGraphQLRequest(mutation, {
            projectId: this.projectNodeId,
            itemId: projectItemId,
            fieldId: fieldId,
            value: fieldValue
        });
    }

    formatJobTitle(jobData) {
        const budget = jobData.budget ? `[${jobData.budget.toLocaleString()} THB] ` : '';
        return `${budget}${jobData.title}`;
    }

    formatJobDescription(jobData) {
        const size = jobData.budget ? this.calculateSize(jobData.budget) : 'XS';
        const startDate = jobData.inserted_at ? this.formatDateForGitHub(jobData.inserted_at) : null;
        const endDate = this.extractEndDate(jobData);
        
        const sections = [
            `## Job Details`,
            `**Title:** ${jobData.title}`,
            `**Budget:** ${jobData.budget ? `${jobData.budget.toLocaleString()} THB` : 'Not specified'}`,
            `**Size:** ${size}`,
            `**Category:** ${jobData.category || 'Other'}`,
            `**Start Date:** ${startDate || 'Not specified'}`,
            `**End Date:** ${endDate || 'Not specified'}`,
            `**Fastwork URL:** [View Job](${jobData.url})`,
            ``,
            `## Description`,
            jobData.description || 'No description provided',
            ``,
            `## Additional Information`,
            `- **Job ID:** ${jobData.id}`,
            `- **Created:** ${jobData.created_at ? new Date(jobData.created_at).toLocaleDateString() : 'Unknown'}`,
            `- **Inserted:** ${jobData.inserted_at ? new Date(jobData.inserted_at).toLocaleDateString() : 'Unknown'}`,
            `- **Source:** Fastwork.co`,
            ``
        ];

        // Add tags if available
        const tags = this.generateTags(jobData);
        if (tags.length > 0) {
            sections.push(`**Tags:** ${tags.map(tag => `\`${tag}\``).join(', ')}`);
        }

        return sections.join('\n');
    }

    generateTags(jobData) {
        const tags = [];
        
        // Add budget-based tags
        if (jobData.budget) {
            if (jobData.budget >= 50000) {
                tags.push('high-budget');
            } else if (jobData.budget >= 20000) {
                tags.push('medium-budget');
            } else if (jobData.budget > 0) {
                tags.push('low-budget');
            }
        } else {
            tags.push('no-budget');
        }

        // Add category-based tags
        if (jobData.category) {
            const categoryTag = jobData.category.toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            tags.push(categoryTag);
        }

        // Add content-based tags
        const description = (jobData.description || '').toLowerCase();
        const title = (jobData.title || '').toLowerCase();
        const content = `${title} ${description}`;

        if (content.includes('urgent') || content.includes('ด่วน')) {
            tags.push('urgent');
        }
        if (content.includes('remote') || content.includes('wfh') || content.includes('work from home')) {
            tags.push('remote');
        }
        if (content.includes('full time') || content.includes('full-time')) {
            tags.push('full-time');
        }
        if (content.includes('part time') || content.includes('part-time')) {
            tags.push('part-time');
        }

        return tags;
    }

    calculateSize(budget) {
        // Determine size based on budget ranges
        if (!budget || budget === 0) {
            return 'XS'; // No budget
        } else if (budget < 5000) {
            return 'XS'; // Very small budget
        } else if (budget < 15000) {
            return 'S'; // Small budget
        } else if (budget < 30000) {
            return 'M'; // Medium budget
        } else if (budget < 60000) {
            return 'L'; // Large budget
        } else {
            return 'XL'; // Very large budget
        }
    }

    formatDateForGitHub(dateString) {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return null;
            
            // GitHub expects YYYY-MM-DD format
            return date.toISOString().split('T')[0];
        } catch (error) {
            logger.logError('GitHubProjectsService.formatDateForGitHub', error, { dateString });
            return null;
        }
    }

    extractEndDate(jobData) {
        try {
            // Try to get deadline from raw_data
            if (jobData.raw_data) {
                const rawData = typeof jobData.raw_data === 'string' 
                    ? JSON.parse(jobData.raw_data) 
                    : jobData.raw_data;
                
                if (rawData.deadline_at) {
                    return this.formatDateForGitHub(rawData.deadline_at);
                }
                
                if (rawData.expired_at) {
                    return this.formatDateForGitHub(rawData.expired_at);
                }
            }
            
            // Fallback: calculate 30 days from insertion date
            if (jobData.inserted_at) {
                const insertDate = new Date(jobData.inserted_at);
                insertDate.setDate(insertDate.getDate() + 30);
                return this.formatDateForGitHub(insertDate.toISOString());
            }
            
            return null;
        } catch (error) {
            logger.logError('GitHubProjectsService.extractEndDate', error, { 
                jobId: jobData.id,
                rawDataExists: !!jobData.raw_data 
            });
            return null;
        }
    }

    async makeGraphQLRequest(query, variables = {}) {
        try {
            const response = await fetch(this.apiBase, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            if (data.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
            }

            return data;
        } catch (error) {
            logger.logError('GitHubProjectsService.makeGraphQLRequest', error, {
                query: query.substring(0, 100) + '...',
                variables
            });
            throw error;
        }
    }

    async testConnection() {
        try {
            const query = `
                query {
                    viewer {
                        login
                    }
                }
            `;

            const response = await this.makeGraphQLRequest(query);
            
            logger.logInfo('GitHubProjectsService.testConnection', 'GitHub API connection successful', {
                authenticatedUser: response.data.viewer.login
            });
            
            return {
                success: true,
                user: response.data.viewer.login
            };
        } catch (error) {
            logger.logError('GitHubProjectsService.testConnection', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}