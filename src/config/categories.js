import { JOB_CATEGORIES } from '../api/fastwork.js';

export const DEFAULT_CONFIG = {
    categories: {
        enabled: [
            JOB_CATEGORIES.APPLICATION_DEVELOPMENT.id,
            JOB_CATEGORIES.WEB_DEVELOPMENT.id
        ],
        all: Object.values(JOB_CATEGORIES)
    },
    processing: {
        minBudget: 10000,
        maxJobsPerRun: 5,
        pageSize: 20
    },
    analysis: {
        enabled: true,
        batchSize: 5,
        delayBetweenRequests: 1000
    },
    notifications: {
        facebook: {
            enabled: true,
            formatStyle: 'markdown'
        },
        telegram: {
            enabled: true,
            formatStyle: 'markdown'
        }
    }
};

export class CategoryManager {
    constructor(config = DEFAULT_CONFIG) {
        this.config = config;
    }

    getEnabledCategories() {
        return this.config.categories.enabled;
    }

    getAllCategories() {
        return this.config.categories.all;
    }

    getCategoryInfo(categoryId) {
        return this.config.categories.all.find(cat => cat.id === categoryId);
    }

    isCategoryEnabled(categoryId) {
        return this.config.categories.enabled.includes(categoryId);
    }

    enableCategory(categoryId) {
        if (!this.config.categories.enabled.includes(categoryId)) {
            this.config.categories.enabled.push(categoryId);
        }
    }

    disableCategory(categoryId) {
        this.config.categories.enabled = this.config.categories.enabled.filter(
            id => id !== categoryId
        );
    }

    getProcessingConfig() {
        return this.config.processing;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    getFormattedCategoriesList() {
        return this.config.categories.all.map(cat => ({
            id: cat.id,
            name: cat.nameEn,
            nameTh: cat.name,
            enabled: this.isCategoryEnabled(cat.id)
        }));
    }
}