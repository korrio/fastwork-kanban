class FastworkKanban {
    constructor() {
        this.apiBase = '/api';
        this.currentJob = null;
        this.kanbanData = { jobs: [], interested: [], proposed: [], archived: [] };
        this.localStorageKey = 'fastwork-kanban-positions';
        this.jobCacheKey = 'fastwork-kanban-cache';
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        this.initializeEventListeners();
        this.initializeDragAndDrop();
        this.loadKanbanBoard();
        this.loadStats();
    }

    initializeEventListeners() {
        // Header buttons
        document.getElementById('fetch-jobs-btn').addEventListener('click', () => this.fetchJobs());
        document.getElementById('analyze-jobs-btn').addEventListener('click', () => this.analyzeJobs());
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadKanbanBoard());
        document.getElementById('clear-storage-btn').addEventListener('click', () => this.clearLocalStorage());
        document.getElementById('fetch-all-btn').addEventListener('click', () => this.fetchAllJobs());
        document.getElementById('github-test-btn').addEventListener('click', () => this.testGitHubIntegration());
        document.getElementById('github-sync-btn').addEventListener('click', () => this.syncToGitHub());

        // Modal
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-notes-btn').addEventListener('click', () => this.saveNotes());
        
        // Close modal when clicking outside
        document.getElementById('job-modal').addEventListener('click', (e) => {
            if (e.target.id === 'job-modal') {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    initializeDragAndDrop() {
        const columns = ['jobs', 'interested', 'proposed', 'archived'];
        
        columns.forEach(status => {
            const columnElement = document.getElementById(`${status}-column`);
            
            Sortable.create(columnElement, {
                group: 'kanban',
                animation: 200,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                
                onStart: (evt) => {
                    evt.item.classList.add('dragging');
                },
                
                onEnd: (evt) => {
                    evt.item.classList.remove('dragging');
                    
                    const jobId = evt.item.dataset.jobId;
                    const fromStatus = evt.from.id.replace('-column', '');
                    const toStatus = evt.to.id.replace('-column', '');
                    
                    if (fromStatus !== toStatus) {
                        this.moveJob(jobId, fromStatus, toStatus);
                    }
                    
                    // Save current positions to localStorage
                    this.savePositionsToLocal();
                },
                
                onAdd: (evt) => {
                    const columnElement = evt.to;
                    columnElement.classList.remove('drag-over');
                },
                
                onRemove: (evt) => {
                    // Update source column count
                    this.updateColumnCounts();
                }
            });
        });
    }

    async loadKanbanBoard() {
        this.showLoading(true);
        
        try {
            // Try to load from cache first
            const cachedData = this.loadFromCache();
            if (cachedData) {
                console.log('Loading kanban board from cache');
                this.kanbanData = cachedData;
                this.renderKanbanBoard();
                this.updateColumnCounts();
                this.showLoading(false);
                
                // Load fresh data in background and update if different
                this.loadFreshDataInBackground();
                return;
            }

            // Load fresh data
            const response = await fetch(`${this.apiBase}/kanban/board`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.kanbanData = await response.json();
            
            // Apply local position overrides
            this.applyLocalPositions();
            
            // Cache the data
            this.saveToCache(this.kanbanData);
            
            this.renderKanbanBoard();
            this.updateColumnCounts();
            
        } catch (error) {
            console.error('Error loading kanban board:', error);
            this.showToast('Failed to load kanban board', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderKanbanBoard() {
        const columns = ['jobs', 'interested', 'proposed', 'archived'];
        
        columns.forEach(status => {
            const columnElement = document.getElementById(`${status}-column`);
            columnElement.innerHTML = '';
            
            const jobs = this.kanbanData[status] || [];
            
            jobs.forEach(job => {
                const jobCard = this.createJobCard(job);
                columnElement.appendChild(jobCard);
            });
        });
    }

    createJobCard(job) {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.dataset.jobId = job.id;
        card.dataset.category = job.category || 'Other';
        
        const truncatedTitle = job.title.length > 60 ? 
            job.title.substring(0, 57) + '...' : job.title;
        
        const truncatedDescription = job.description ? 
            (job.description.length > 120 ? 
                job.description.substring(0, 117) + '...' : job.description) : 
            'No description available';
        
        const formatDate = (dateString) => {
            if (!dateString) return 'Unknown';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        };

        const statusClass = job.analysis ? 'analyzed' : 'pending';
        const statusText = job.analysis ? 'Analyzed' : 'Pending';

        const getCategoryClass = (category) => {
            const categoryMap = {
                'Application Development': 'application-development',
                'Web Development': 'web-development',
                'IT Solutions': 'it-solutions',
                'IoT Work': 'iot-work',
                'Other': 'other'
            };
            return categoryMap[category] || 'other';
        };

        const categoryClass = getCategoryClass(job.category || 'Other');

        card.innerHTML = `
            <div class="job-category ${categoryClass}">${job.category || 'Other'}</div>
            <div class="job-title">${truncatedTitle}</div>
            <div class="job-budget">${job.budget?.toLocaleString() || 'N/A'} THB</div>
            <div class="job-description">${truncatedDescription}</div>
            <div class="job-meta">
                <span class="job-date">${formatDate(job.created_at)}</span>
                <span class="job-status ${statusClass}">${statusText}</span>
            </div>
        `;

        card.addEventListener('click', () => this.showJobModal(job));
        
        return card;
    }

    async moveJob(jobId, fromStatus, toStatus) {
        try {
            const response = await fetch(`${this.apiBase}/kanban/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jobId,
                    fromStatus,
                    toStatus
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Update local data
            const jobIndex = this.kanbanData[fromStatus].findIndex(job => job.id === jobId);
            if (jobIndex !== -1) {
                const job = this.kanbanData[fromStatus].splice(jobIndex, 1)[0];
                job.kanban_status = toStatus;
                this.kanbanData[toStatus].push(job);
            }

            // Save updated data to cache and localStorage
            this.saveToCache(this.kanbanData);
            this.savePositionsToLocal();

            this.updateColumnCounts();
            this.showToast(`Job moved to ${toStatus}`, 'success');
            
        } catch (error) {
            console.error('Error moving job:', error);
            this.showToast('Failed to move job', 'error');
            // Reload the board to revert changes
            this.loadKanbanBoard();
        }
    }

    showJobModal(job) {
        this.currentJob = job;
        
        document.getElementById('modal-title').textContent = job.title;
        document.getElementById('modal-budget').textContent = `${job.budget?.toLocaleString() || 'N/A'} THB`;
        document.getElementById('modal-category').textContent = job.category || 'Other';
        document.getElementById('modal-created').textContent = new Date(job.created_at).toLocaleDateString();
        document.getElementById('modal-url').href = job.url || '#';
        document.getElementById('modal-description').textContent = job.description || 'No description available';
        document.getElementById('modal-analysis').textContent = job.analysis || 'No analysis available yet';
        document.getElementById('modal-notes').value = job.notes || '';
        
        document.getElementById('job-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('job-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        this.currentJob = null;
    }

    async saveNotes() {
        if (!this.currentJob) return;
        
        const notes = document.getElementById('modal-notes').value;
        
        try {
            const response = await fetch(`${this.apiBase}/jobs/${this.currentJob.id}/notes`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notes })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.currentJob.notes = notes;
            this.showToast('Notes saved successfully', 'success');
            
        } catch (error) {
            console.error('Error saving notes:', error);
            this.showToast('Failed to save notes', 'error');
        }
    }

    async fetchJobs() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/jobs/fetch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit: 20 })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.showToast(`Fetched ${result.jobs.length} new jobs from ${result.categories} categories - Click "Analyze" to process them`, 'success');
            
            // Reload the board to show new jobs
            setTimeout(() => {
                this.loadKanbanBoard();
                this.loadStats();
            }, 1000);
            
        } catch (error) {
            console.error('Error fetching jobs:', error);
            this.showToast('Failed to fetch jobs', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeJobs() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/jobs/analyze`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.showToast(`Analyzed ${result.count} jobs`, 'success');
            
            // Reload the board to show updated analysis
            setTimeout(() => {
                this.loadKanbanBoard();
            }, 1000);
            
        } catch (error) {
            console.error('Error analyzing jobs:', error);
            this.showToast('Failed to analyze jobs', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStats() {
        try {
            const [overviewResponse, kanbanResponse] = await Promise.all([
                fetch(`${this.apiBase}/jobs/stats/overview`),
                fetch(`${this.apiBase}/kanban/stats`)
            ]);

            if (overviewResponse.ok && kanbanResponse.ok) {
                const overview = await overviewResponse.json();
                const kanbanStats = await kanbanResponse.json();

                // Update header stats
                document.getElementById('total-jobs').textContent = overview.total;
                document.getElementById('interested-count').textContent = 
                    overview.byStatus?.interested || 0;
                document.getElementById('proposed-count').textContent = 
                    overview.byStatus?.proposed || 0;
                document.getElementById('avg-budget').textContent = 
                    `${overview.avgBudget?.toLocaleString() || 0} THB`;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateColumnCounts() {
        const columns = ['jobs', 'interested', 'proposed', 'archived'];
        
        columns.forEach(status => {
            const count = this.kanbanData[status]?.length || 0;
            const badge = document.getElementById(`${status === 'jobs' ? 'jobs' : status}-count-badge`);
            if (badge) {
                badge.textContent = count;
            }
        });
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (show) {
            loadingElement.classList.remove('hidden');
        } else {
            loadingElement.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const messageElement = document.getElementById('toast-message');
        
        messageElement.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // LocalStorage Persistence Methods
    savePositionsToLocal() {
        try {
            const positions = {};
            const columns = ['jobs', 'interested', 'proposed', 'archived'];
            
            columns.forEach(status => {
                const columnElement = document.getElementById(`${status}-column`);
                const jobCards = columnElement.querySelectorAll('.job-card');
                
                positions[status] = Array.from(jobCards).map(card => ({
                    jobId: card.dataset.jobId,
                    position: Array.from(card.parentNode.children).indexOf(card)
                }));
            });

            const positionData = {
                positions,
                timestamp: Date.now(),
                version: '1.0'
            };

            localStorage.setItem(this.localStorageKey, JSON.stringify(positionData));
            console.log('Saved positions to localStorage:', positions);
            
        } catch (error) {
            console.error('Error saving positions to localStorage:', error);
        }
    }

    loadPositionsFromLocal() {
        try {
            const storedData = localStorage.getItem(this.localStorageKey);
            if (!storedData) return null;

            const positionData = JSON.parse(storedData);
            
            // Check if data is too old (older than 24 hours)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (Date.now() - positionData.timestamp > maxAge) {
                localStorage.removeItem(this.localStorageKey);
                return null;
            }

            return positionData.positions;
        } catch (error) {
            console.error('Error loading positions from localStorage:', error);
            return null;
        }
    }

    applyLocalPositions() {
        const localPositions = this.loadPositionsFromLocal();
        if (!localPositions) return;

        console.log('Applying local positions:', localPositions);

        Object.keys(localPositions).forEach(status => {
            if (!this.kanbanData[status]) return;

            const positionMap = {};
            localPositions[status].forEach(item => {
                positionMap[item.jobId] = item.position;
            });

            // Sort jobs by their local positions
            this.kanbanData[status].sort((a, b) => {
                const posA = positionMap[a.id] !== undefined ? positionMap[a.id] : 9999;
                const posB = positionMap[b.id] !== undefined ? positionMap[b.id] : 9999;
                return posA - posB;
            });

            // Move jobs to correct columns if they were moved locally
            const jobsToMove = [];
            this.kanbanData[status].forEach(job => {
                if (job.kanban_status !== status) {
                    jobsToMove.push({ job, fromStatus: job.kanban_status, toStatus: status });
                }
            });

            // Process moves
            jobsToMove.forEach(({ job, fromStatus, toStatus }) => {
                const originalIndex = this.kanbanData[fromStatus].findIndex(j => j.id === job.id);
                if (originalIndex !== -1) {
                    this.kanbanData[fromStatus].splice(originalIndex, 1);
                    job.kanban_status = toStatus;
                    // Job is already in the destination array from local positions
                }
            });
        });
    }

    saveToCache(data) {
        try {
            const cacheData = {
                data,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem(this.jobCacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    loadFromCache() {
        try {
            const storedData = localStorage.getItem(this.jobCacheKey);
            if (!storedData) return null;

            const cacheData = JSON.parse(storedData);
            
            // Check if cache is expired
            if (Date.now() - cacheData.timestamp > this.cacheExpiry) {
                localStorage.removeItem(this.jobCacheKey);
                return null;
            }

            return cacheData.data;
        } catch (error) {
            console.error('Error loading from cache:', error);
            return null;
        }
    }

    async loadFreshDataInBackground() {
        try {
            const response = await fetch(`${this.apiBase}/kanban/board`);
            if (!response.ok) return;

            const freshData = await response.json();
            
            // Check if there are differences (new jobs, status changes, etc.)
            const hasChanges = this.hasDataChanges(this.kanbanData, freshData);
            
            if (hasChanges) {
                console.log('Fresh data has changes, updating...');
                
                // Merge fresh data with local positions
                this.kanbanData = freshData;
                this.applyLocalPositions();
                this.saveToCache(this.kanbanData);
                
                // Re-render board
                this.renderKanbanBoard();
                this.updateColumnCounts();
                
                this.showToast('Board updated with fresh data', 'info');
            }
        } catch (error) {
            console.error('Error loading fresh data in background:', error);
        }
    }

    hasDataChanges(oldData, newData) {
        // Simple comparison based on total job count and job IDs
        const oldTotal = Object.values(oldData).reduce((sum, jobs) => sum + jobs.length, 0);
        const newTotal = Object.values(newData).reduce((sum, jobs) => sum + jobs.length, 0);
        
        if (oldTotal !== newTotal) return true;

        // Check for new job IDs
        const oldIds = new Set();
        const newIds = new Set();
        
        Object.values(oldData).forEach(jobs => jobs.forEach(job => oldIds.add(job.id)));
        Object.values(newData).forEach(jobs => jobs.forEach(job => newIds.add(job.id)));
        
        return oldIds.size !== newIds.size || ![...newIds].every(id => oldIds.has(id));
    }

    async fetchAllJobs() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/jobs/fetch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit: 30, minBudget: 0 }) // No budget filter
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.showToast(`Fetched ${result.jobs.length} jobs (all budgets) from ${result.categories} categories`, 'info');
            
            // Reload the board to show new jobs
            setTimeout(() => {
                this.loadKanbanBoard();
                this.loadStats();
            }, 1000);
            
        } catch (error) {
            console.error('Error fetching all jobs:', error);
            this.showToast('Failed to fetch all jobs', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    clearLocalStorage() {
        localStorage.removeItem(this.localStorageKey);
        localStorage.removeItem(this.jobCacheKey);
        console.log('Cleared localStorage');
        this.showToast('Local storage cleared', 'info');
    }

    async testGitHubIntegration() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/jobs/github/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.connection && result.connection.success) {
                this.showToast(`✅ GitHub connection successful! Authenticated as: ${result.connection.user}`, 'success');
            } else {
                this.showToast(`❌ GitHub connection failed: ${result.error || 'Unknown error'}`, 'error');
            }
            
        } catch (error) {
            console.error('Error testing GitHub integration:', error);
            this.showToast('Failed to test GitHub integration', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async syncToGitHub() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/jobs/github/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit: 10 })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            this.showToast(`📋 ${result.message}`, result.syncedCount > 0 ? 'success' : 'info');
            
            // Show detailed results in console
            console.log('GitHub sync results:', result);
            
        } catch (error) {
            console.error('Error syncing to GitHub:', error);
            this.showToast('Failed to sync jobs to GitHub', 'error');
        } finally {
            this.showLoading(false);
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FastworkKanban();
});