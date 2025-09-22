import axios from 'axios';
import logger from '../utils/logger.js';

const FASTWORK_API_BASE = 'https://jobboard-api.fastwork.co/api';

export const JOB_CATEGORIES = {
    APPLICATION_DEVELOPMENT: {
        id: 'c82d3ff0-c1c1-4b39-b9e3-124e513eb66c',
        name: 'พัฒนาแอปพลิเคชัน',
        nameEn: 'Application Development'
    },
    WEB_DEVELOPMENT: {
        id: '4c7ee9da-5509-4ff1-b7c2-df81fb2ef06c',
        name: 'พัฒนาเว็บไซต์',
        nameEn: 'Web Development'
    },
    IT_SOLUTIONS: {
        id: '2a0001e2-d5d9-4fb8-92da-f4a805c47044',
        name: 'ไอทีโซลูชั่น',
        nameEn: 'IT Solutions'
    },
    IOT_WORK: {
        id: '9f240bc1-fde2-4217-a5f5-f6fc02ba3f54',
        name: 'งาน IoT',
        nameEn: 'IoT Work'
    }
};

const DEFAULT_TAG_ID = JOB_CATEGORIES.APPLICATION_DEVELOPMENT.id;

export class FastworkAPI {
    constructor() {
        this.client = axios.create({
            baseURL: FASTWORK_API_BASE,
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FastworkJobBot/1.0'
            }
        });
    }

    async fetchJobs(options = {}) {
        const {
            page = 1,
            pageSize = 20,
            tagIds = [DEFAULT_TAG_ID],
            orderBy = 'inserted_at',
            orderDirection = 'desc'
        } = options;

        const startTime = Date.now();
        const url = '/jobs';

        try {
            const params = {
                page,
                page_size: pageSize,
                'order_by[]': orderBy,
                'order_directions[]': orderDirection
            };

            // Support multiple tag_id filters
            const tagIdArray = Array.isArray(tagIds) ? tagIds : [tagIds];
            tagIdArray.forEach((tagId, index) => {
                params[`filters[${index}][field]`] = 'tag_id';
                params[`filters[${index}][value]`] = tagId;
            });

            // Log the API call attempt with full URL
            const categoryNames = tagIdArray.map(id => this.constructor.getCategoryName(id));
            const queryParams = new URLSearchParams(params);
            const fullUrl = `${FASTWORK_API_BASE}${url}?${queryParams.toString()}`;
            
            logger.logApiCall('GET', fullUrl, {
                page,
                pageSize,
                categories: categoryNames,
                orderBy,
                orderDirection,
                tagIds: tagIdArray
            });

            const response = await this.client.get(url, { params });
            const duration = Date.now() - startTime;
            
            if (response.data && response.data.data) {
                const result = {
                    jobs: response.data.data,
                    pagination: response.data.meta || {},
                    success: true
                };

                // Log successful response
                logger.logApiCall('GET', fullUrl, null, result, duration);
                
                return result;
            }
            
            const result = { jobs: [], pagination: {}, success: false };
            logger.logApiCall('GET', fullUrl, null, result, duration);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            // Reconstruct params for error logging
            const errorTagIds = Array.isArray(tagIds) ? tagIds : [tagIds];
            const errorParams = {
                page,
                page_size: pageSize,
                'order_by[]': orderBy,
                'order_directions[]': orderDirection
            };
            errorTagIds.forEach((tagId, index) => {
                errorParams[`filters[${index}][field]`] = 'tag_id';
                errorParams[`filters[${index}][value]`] = tagId;
            });
            const queryParams = new URLSearchParams(errorParams);
            const fullUrl = `${FASTWORK_API_BASE}${url}?${queryParams.toString()}`;
            logger.logApiCall('GET', fullUrl, null, null, duration, error);
            logger.logError('FastworkAPI.fetchJobs', error, { options, tagIds: errorTagIds });
            
            return { 
                jobs: [], 
                pagination: {}, 
                success: false, 
                error: error.message 
            };
        }
    }

    async fetchJobDetails(jobId) {
        const startTime = Date.now();
        const url = `/jobs/${jobId}`;
        const fullUrl = `${FASTWORK_API_BASE}${url}`;

        try {
            logger.logApiCall('GET', fullUrl, { jobId });
            
            const response = await this.client.get(url);
            const duration = Date.now() - startTime;
            
            const result = {
                job: response.data.data,
                success: true
            };

            logger.logApiCall('GET', fullUrl, null, { success: true, hasJob: !!response.data.data }, duration);
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.logApiCall('GET', fullUrl, null, null, duration, error);
            logger.logError('FastworkAPI.fetchJobDetails', error, { jobId });
            
            return {
                job: null,
                success: false,
                error: error.message
            };
        }
    }

    static generateJobUrl(jobId) {
        return `https://jobboard.fastwork.co/jobs/${jobId}`;
    }

    static getCategoryName(tagId) {
        for (const category of Object.values(JOB_CATEGORIES)) {
            if (category.id === tagId) {
                return category.nameEn;
            }
        }
        return 'Unknown Category';
    }

    async fetchAllCategories(options = {}) {
        const startTime = Date.now();
        const allJobs = [];
        const categoryIds = Object.values(JOB_CATEGORIES).map(cat => cat.id);
        
        logger.logJobProcessing('FETCH_ALL_CATEGORIES_START', 0, categoryIds.length, null, {
            categories: Object.values(JOB_CATEGORIES).map(cat => cat.nameEn),
            options
        });
        
        for (const tagId of categoryIds) {
            const categoryName = this.constructor.getCategoryName(tagId);
            const categoryStartTime = Date.now();
            
            const result = await this.fetchJobs({ ...options, tagIds: [tagId] });
            const categoryDuration = Date.now() - categoryStartTime;
            
            if (result.success) {
                const jobsWithCategory = result.jobs.map(job => ({
                    ...job,
                    category: categoryName
                }));
                allJobs.push(...jobsWithCategory);
                
                logger.logJobProcessing('CATEGORY_FETCHED', result.jobs.length, null, categoryDuration, {
                    category: categoryName,
                    pagination: result.pagination
                });
            } else {
                logger.logError('fetchAllCategories', new Error(`Failed to fetch category: ${categoryName}`), {
                    tagId,
                    categoryName,
                    error: result.error
                });
            }
        }

        const totalDuration = Date.now() - startTime;
        const result = {
            jobs: allJobs,
            success: true,
            categoriesCount: categoryIds.length
        };

        logger.logJobProcessing('FETCH_ALL_CATEGORIES_COMPLETE', allJobs.length, categoryIds.length, totalDuration, {
            jobsPerCategory: categoryIds.map(id => ({
                category: this.constructor.getCategoryName(id),
                count: allJobs.filter(job => job.category === this.constructor.getCategoryName(id)).length
            }))
        });

        return result;
    }
}