-- =====================================================
-- PERFORMANCE OPTIMIZATION: INDEXING SCRIPT (FIXED)
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Tasks Table Optimization
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_status ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- 2. Ideas / Intelligence Table Optimization
CREATE INDEX IF NOT EXISTS idx_ideas_created_by_status ON ideas(created_by, status);
CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_priority ON ideas(priority);

-- 3. Profiles / Staff Optimization
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);

-- 4. Leads & Sales Optimization
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_tutor_id ON demo_requests(tutor_id);

-- 5. Request & Signals Optimization
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_submitted_by ON requests(submitted_by);
