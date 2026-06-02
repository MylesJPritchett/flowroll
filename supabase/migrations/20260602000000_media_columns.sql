-- Add media JSONB columns to positions, actions, and states tables.
-- Media items are arrays of: { type: "image"|"youtube", url, caption?, start?, end? }

alter table positions add column if not exists media jsonb not null default '[]';
alter table actions add column if not exists media jsonb not null default '[]';
alter table states add column if not exists media jsonb not null default '[]';
