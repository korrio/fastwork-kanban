// Fastwork Job Bot Configuration
export const CONFIG = {
    // Job filtering settings
    budget: {
        minimum: 5000, // Minimum budget in THB
        currency: 'THB'
    },

    // Fetching settings
    fetching: {
        cronSchedule: '*/5 * * * *', // Every 5 minutes
        defaultLimit: 30, // Default number of jobs to fetch per cycle
        pageSize: 20, // Jobs per category per request
        bufferMultiplier: 10 // Extra jobs to fetch for filtering
    },

    // Categories to fetch from
    categories: {
        enabled: [
            'APPLICATION_DEVELOPMENT',
            'WEB_DEVELOPMENT', 
            'IT_SOLUTIONS',
            'IOT_WORK'
        ]
    },

    // API settings
    api: {
        timeout: 10000, // 10 seconds
        timezone: 'Asia/Bangkok'
    },

    // Logging settings
    logging: {
        enabled: true,
        maxErrors: 10,
        logDirectory: 'logs'
    },

    // GitHub Projects integration
    github: {
        enabled: true,
        token: process.env.GITHUB_TOKEN,
        projectUrl: process.env.GITHUB_PROJECT_URL || 'https://github.com/users/korrio/projects/4',
        issuesRepo: process.env.GITHUB_ISSUES_REPO || 'korrio/fastwork-kanban',
        syncOnFetch: true // Auto-create project items when new jobs are fetched
    }
};

export default CONFIG;