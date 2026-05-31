-- Position requirements: conditions that MUST be present for a position to be valid
-- e.g., Spider Guard requires at least one sleeve grip
-- Run after supabase-taxonomy.sql

create table position_requirements (
  id text primary key default gen_random_uuid()::text,
  position_id text not null references positions(id) on delete cascade,
  condition_option_id text not null references condition_options(id) on delete cascade,
  role text not null check (role in ('A', 'B')),
  unique (position_id, condition_option_id, role)
);

create index idx_pos_req_position on position_requirements (position_id);

-- Action prerequisites: add required and forbidden conditions as JSONB
-- Each is an array of { groupId, value, role } objects
ALTER TABLE actions ADD COLUMN IF NOT EXISTS required_conditions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE actions ADD COLUMN IF NOT EXISTS forbidden_conditions jsonb NOT NULL DEFAULT '[]';
