#!/usr/bin/env node

import { GitHubProjectsService } from '../src/services/githubProjects.js';
import { CONFIG } from '../src/config/settings.js';
import logger from '../src/utils/logger.js';

async function clearGitHubProject() {
    console.log('🧹 Clearing GitHub Project items...');
    
    try {
        // Initialize GitHub service
        const githubService = new GitHubProjectsService(
            CONFIG.github.token,
            CONFIG.github.projectUrl
        );
        
        const initialized = await githubService.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize GitHub service');
        }
        
        console.log('✅ GitHub service initialized');
        
        // Get all project items
        const items = await getAllProjectItems(githubService);
        console.log(`📋 Found ${items.length} items in project`);
        
        if (items.length === 0) {
            console.log('✅ Project is already empty');
            return;
        }
        
        // Delete all items
        let deletedCount = 0;
        for (const item of items) {
            try {
                const result = await deleteProjectItem(githubService, item.id);
                if (result) {
                    deletedCount++;
                    console.log(`🗑️  Deleted item: ${item.content?.title || item.id}`);
                }
            } catch (error) {
                console.error(`❌ Failed to delete item ${item.id}:`, error.message);
            }
        }
        
        console.log(`✅ Cleared ${deletedCount}/${items.length} items from GitHub project`);
        
    } catch (error) {
        console.error('❌ Error clearing GitHub project:', error.message);
        process.exit(1);
    }
}

async function getAllProjectItems(githubService) {
    const query = `
        query($owner: String!, $projectNumber: Int!, $after: String) {
            user(login: $owner) {
                projectV2(number: $projectNumber) {
                    items(first: 100, after: $after) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            id
                            type
                            content {
                                ... on Issue {
                                    id
                                    title
                                    number
                                }
                                ... on DraftIssue {
                                    id
                                    title
                                }
                                ... on PullRequest {
                                    id
                                    title
                                    number
                                }
                            }
                        }
                    }
                }
            }
        }
    `;
    
    const items = [];
    let hasNextPage = true;
    let cursor = null;
    
    while (hasNextPage) {
        const response = await githubService.makeGraphQLRequest(query, {
            owner: githubService.owner,
            projectNumber: githubService.projectNumber,
            after: cursor
        });
        
        const projectItems = response.data.user.projectV2.items;
        items.push(...projectItems.nodes);
        
        hasNextPage = projectItems.pageInfo.hasNextPage;
        cursor = projectItems.pageInfo.endCursor;
    }
    
    return items;
}

async function deleteProjectItem(githubService, itemId) {
    const mutation = `
        mutation($projectId: ID!, $itemId: ID!) {
            deleteProjectV2Item(
                input: {
                    projectId: $projectId
                    itemId: $itemId
                }
            ) {
                deletedItemId
            }
        }
    `;
    
    try {
        const response = await githubService.makeGraphQLRequest(mutation, {
            projectId: githubService.projectNodeId,
            itemId: itemId
        });
        
        return response.data.deleteProjectV2Item.deletedItemId === itemId;
    } catch (error) {
        console.error(`Failed to delete item ${itemId}:`, error.message);
        return false;
    }
}

// Run the script
clearGitHubProject().catch(console.error);