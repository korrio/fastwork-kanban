-- Add GitHub sync tracking fields to jobs table
ALTER TABLE jobs ADD COLUMN github_synced BOOLEAN DEFAULT 0;
ALTER TABLE jobs ADD COLUMN github_project_item_id TEXT;
ALTER TABLE jobs ADD COLUMN github_synced_at DATETIME;

-- Add index for github_synced field
CREATE INDEX IF NOT EXISTS idx_jobs_github_synced ON jobs(github_synced);