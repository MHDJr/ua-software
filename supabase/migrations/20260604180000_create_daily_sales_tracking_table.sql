-- Create daily_sales_tracking table to support draft metric auto-saves
CREATE TABLE IF NOT EXISTS daily_sales_tracking (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    evaluations_taken INTEGER NOT NULL DEFAULT 0,
    lost_leads INTEGER NOT NULL DEFAULT 0,
    lead_quality_rating INTEGER NOT NULL DEFAULT 5 CHECK (lead_quality_rating >= 1 AND lead_quality_rating <= 10),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, tracking_date)
);

-- Enable RLS
ALTER TABLE daily_sales_tracking ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own daily sales tracking"
ON daily_sales_tracking FOR ALL
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "CEO can view all daily sales tracking"
ON daily_sales_tracking FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_daily_sales_tracking_profile_date ON daily_sales_tracking(profile_id, tracking_date);

-- Grant permissions
GRANT ALL ON daily_sales_tracking TO authenticated;
