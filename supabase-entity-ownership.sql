-- Add ownership, official flag, and public visibility to all taxonomy tables
-- Run this after supabase-taxonomy.sql and supabase-actions.sql

-- positions
ALTER TABLE positions ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- condition_groups
ALTER TABLE condition_groups ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE condition_groups ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE condition_groups ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- condition_options
ALTER TABLE condition_options ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE condition_options ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE condition_options ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- actions
ALTER TABLE actions ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Mark all existing seeded data as official
UPDATE positions SET is_official = true WHERE created_by IS NULL;
UPDATE condition_groups SET is_official = true WHERE created_by IS NULL;
UPDATE condition_options SET is_official = true WHERE created_by IS NULL;
UPDATE actions SET is_official = true WHERE created_by IS NULL;
