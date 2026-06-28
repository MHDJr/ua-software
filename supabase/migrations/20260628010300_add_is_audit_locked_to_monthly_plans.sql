-- Add is_audit_locked column to monthly_plans table
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS is_audit_locked BOOLEAN DEFAULT FALSE;
