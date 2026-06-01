-- Add description column to positions table
alter table positions add column if not exists description text not null default '';
