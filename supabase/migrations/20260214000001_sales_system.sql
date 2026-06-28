-- =====================================================
-- SALES SYSTEM TABLES (Safe to run - handles existing policies)
-- =====================================================

-- Create leads table for sales pipeline (if not exists)
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    program_interest TEXT,
    assigned_to UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_scheduled', 'demo_completed', 'converted', 'lost', 'cold')),
    source TEXT,
    notes TEXT,
    next_follow_up TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Create demo sessions table
CREATE TABLE IF NOT EXISTS demo_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES profiles(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')),
    outcome TEXT,
    failure_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create tutor availability table
CREATE TABLE IF NOT EXISTS tutor_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tutor_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'busy', 'unavailable')),
    note TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id)
);

-- Add sales-specific columns to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_sales_staff BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_tutor BOOLEAN DEFAULT false;

-- RLS Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_availability ENABLE ROW LEVEL SECURITY;

-- Leads policies (using existing auth functions)
DROP POLICY IF EXISTS "Leads visible to authorized" ON leads;
CREATE POLICY "Leads visible to authorized" ON leads FOR SELECT
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
    OR auth.uid() = assigned_to
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_sales_staff = true)
);

DROP POLICY IF EXISTS "Sales can insert leads" ON leads;
CREATE POLICY "Sales can insert leads" ON leads FOR INSERT
WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_sales_staff = true)
);

DROP POLICY IF EXISTS "Sales can update leads" ON leads;
CREATE POLICY "Sales can update leads" ON leads FOR UPDATE
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
    OR auth.uid() = assigned_to
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_sales_staff = true)
);

-- Demo sessions policies
DROP POLICY IF EXISTS "Demos visible to authorized" ON demo_sessions;
CREATE POLICY "Demos visible to authorized" ON demo_sessions FOR SELECT
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_sales_staff = true)
    OR auth.uid() = tutor_id
);

DROP POLICY IF EXISTS "Sales can insert demos" ON demo_sessions;
CREATE POLICY "Sales can insert demos" ON demo_sessions FOR INSERT
WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_sales_staff = true)
);

-- Tutor availability policies
DROP POLICY IF EXISTS "Tutor availability visible" ON tutor_availability;
CREATE POLICY "Tutor availability visible" ON tutor_availability FOR SELECT
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_sales_staff = true)
    OR auth.uid() = tutor_id
);

DROP POLICY IF EXISTS "Tutors can update own" ON tutor_availability;
CREATE POLICY "Tutors can update own" ON tutor_availability FOR UPDATE
USING (auth.uid() = tutor_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_lead ON demo_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_tutor_availability ON tutor_availability(tutor_id);

