-- MIGRATION: ADD IS_ARCHIVED TO DAILY_SALES_TRACKING
-- Add is_archived column to support soft-archiving daily sales metric draft saves.

ALTER TABLE public.daily_sales_tracking ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
