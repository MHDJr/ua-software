-- Performance optimization: Add indexes for frequently ordered and filtered columns
CREATE INDEX IF NOT EXISTS idx_tasks_created_at_desc ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at_desc ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_updated_at ON tasks(status, updated_at DESC);

-- Index for leads filtering used in dashboard
CREATE INDEX IF NOT EXISTS idx_leads_updated_at_desc ON leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at_desc ON leads(created_at DESC);

-- Index for requests
CREATE INDEX IF NOT EXISTS idx_requests_created_at_desc ON requests(created_at DESC);
