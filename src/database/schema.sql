CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    budget INTEGER,
    currency TEXT DEFAULT 'THB',
    tag_id TEXT,
    created_at TEXT,
    inserted_at TEXT,
    url TEXT,
    raw_data TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    analysis TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzed', 'notified', 'error')),
    kanban_status TEXT DEFAULT 'jobs' CHECK (kanban_status IN ('jobs', 'interested', 'proposed', 'archived')),
    category TEXT,
    notes TEXT,
    priority INTEGER DEFAULT 0,
    github_synced BOOLEAN DEFAULT 0,
    github_project_item_id TEXT,
    github_synced_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_jobs_budget ON jobs(budget);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_kanban_status ON jobs(kanban_status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_github_synced ON jobs(github_synced);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'telegram')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at DATETIME,
    error_message TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);