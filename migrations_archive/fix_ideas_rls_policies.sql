-- =====================================================
-- FIX IDEAS TABLE RLS POLICIES FOR STAFF SUBMISSIONS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add staff permission to create ideas
DROP POLICY IF EXISTS "Staff can create ideas" ON ideas;
CREATE POLICY "Staff can create ideas"
  ON ideas FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'tutor', 'manager')));

-- Add staff permission to view their own ideas
DROP POLICY IF EXISTS "Staff can view own ideas" ON ideas;
CREATE POLICY "Staff can view own ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Update CEO policy to ensure they can see ALL ideas (not just their own)
DROP POLICY IF EXISTS "CEO can view all ideas" ON ideas;
CREATE POLICY "CEO can view all ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- =====================================================
-- VERIFY POLICIES ARE WORKING
-- =====================================================

-- Test query to check if policies are properly applied
-- This should return all active ideas for CEO users
-- SELECT COUNT(*) FROM ideas WHERE status = 'active';

-- This should allow staff to insert ideas
-- INSERT INTO ideas (title, description, category, priority, status, created_by) 
-- VALUES ('Test Idea', 'Test Description', 'other', 'medium', 'active', 'user_uuid');

-- =====================================================
-- END OF MIGRATION
-- =====================================================
