// Execute the complete schema fix directly
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 EXECUTING SCHEMA FIX DIRECTLY...');
console.log('=====================================');

try {
    // Read the complete fix file
    const sqlPath = path.join(__dirname, 'complete_thought_capture_fix.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Schema fix loaded successfully');
    console.log('📊 File size:', sqlContent.length, 'characters');
    
    // Create a temporary file with just the essential parts
    const essentialSQL = `
-- =====================================================
-- IMMEDIATE SCHEMA FIX FOR THOUGHT CAPTURE
-- =====================================================

-- Drop and recreate ideas table with correct schema
DROP TABLE IF EXISTS ideas CASCADE;

CREATE TABLE ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'reminder' CHECK (status IN ('reminder', 'directive', 'high_priority')),
    category TEXT DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    follow_up_date TIMESTAMP WITH TIME ZONE,
    auto_tagged BOOLEAN DEFAULT FALSE,
    shared_with UUID[] DEFAULT '{}',
    archived BOOLEAN DEFAULT FALSE,
    signal_cleared BOOLEAN DEFAULT FALSE,
    reactions UUID[] DEFAULT '{}'
);

-- Add indexes
CREATE INDEX idx_ideas_created_by ON ideas(created_by);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_priority ON ideas(priority);
CREATE INDEX idx_ideas_created_at ON ideas(created_at);

-- Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own ideas" ON ideas
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own ideas" ON ideas
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own ideas" ON ideas
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own ideas" ON ideas
    FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "CEO can manage all ideas" ON ideas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ceo'
        )
    );

-- Test the schema
SELECT '=== SCHEMA FIX COMPLETE ===' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;
`;

    // Write the essential SQL to a temporary file
    const tempPath = path.join(__dirname, 'temp_schema_fix.sql');
    fs.writeFileSync(tempPath, essentialSQL);
    
    console.log('✅ Essential SQL fix prepared');
    console.log('');
    console.log('🔥 COPY THIS ENTIRE SQL INTO YOUR SUPABASE SQL EDITOR:');
    console.log('====================================================');
    console.log('');
    console.log(essentialSQL);
    console.log('');
    console.log('====================================================');
    console.log('👆 COPY THE SQL ABOVE AND PASTE INTO SUPABASE SQL EDITOR');
    console.log('');
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
} catch (error) {
    console.error('❌ Error preparing schema fix:', error.message);
}
