-- Fix RLS policies for meetings table to prevent infinite recursion
-- Run this in your Supabase SQL editor

-- Drop ALL existing policies on meetings table first
DROP POLICY IF EXISTS "Users can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view relevant meetings" ON meetings;
DROP POLICY IF EXISTS "CEO can update meetings" ON meetings;
DROP POLICY IF EXISTS "CEO can insert meetings" ON meetings;
DROP POLICY IF EXISTS "CEO can manage meetings" ON meetings;

-- Also drop policies on meeting_participants
DROP POLICY IF EXISTS "Users can view their own meeting participation" ON meeting_participants;
DROP POLICY IF EXISTS "CEO can manage meeting participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view meeting participants" ON meeting_participants;

-- Create new, simpler policies for meetings
CREATE POLICY "Users can view meetings"
ON meetings
FOR SELECT
TO authenticated
USING (
    auth.uid() = ANY(attendees) OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo')
);

-- CEO can manage meetings
CREATE POLICY "CEO can manage meetings"
ON meetings
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Create policies for meeting_participants
CREATE POLICY "Users can view meeting participants"
ON meeting_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

CREATE POLICY "CEO can manage meeting participants"
ON meeting_participants
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));
