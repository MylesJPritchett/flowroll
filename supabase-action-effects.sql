-- Action condition effects: conditions auto-applied to the target state
-- Run after supabase-prerequisites.sql

ALTER TABLE actions ADD COLUMN IF NOT EXISTS adds_conditions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE actions ADD COLUMN IF NOT EXISTS removes_conditions jsonb NOT NULL DEFAULT '[]';
