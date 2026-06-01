-- =====================================================
-- FIX IDEAS TABLE SCHEMA AND ENSURE ALL COLUMNS EXIST
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Drop and recreate the ideas table to ensure clean schema
DROP TABLE IF EXISTS ideas CASCADE;

-- Create the ideas table with all required columns
CREATE TABLE ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other', -- 'strategy', 'product', 'operation', 'marketing', 'other'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    status TEXT DEFAULT 'active', -- 'active', 'archived', 'implemented', 'discarded'
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS if not enabled
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- VERIFY TABLE STRUCTURE
-- =====================================================

-- Check the final table structure
-- \d ideas

-- Or use this query to see columns:
-- SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'ideas' ORDER BY ordinal_position;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
