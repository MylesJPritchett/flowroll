-- Reusable actions table (global, like positions)
-- Run this in the Supabase SQL Editor

create table actions (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  gi_nogi text not null default '' check (gi_nogi in ('', 'gi', 'nogi')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Seed with some common BJJ actions
insert into actions (name, description, gi_nogi, sort_order) values
  ('Get Underhook', '', '', 0),
  ('Pummel', '', '', 1),
  ('Hip Escape', '', '', 2),
  ('Bridge', '', '', 3),
  ('Frame', '', '', 4),
  ('Strip Grip', '', '', 5),
  ('Get Collar Grip', '', 'gi', 6),
  ('Get Sleeve Grip', '', 'gi', 7),
  ('Get Wrist Control', '', '', 8),
  ('Knee Shield Insert', '', '', 9),
  ('Reguard', '', '', 10),
  ('Pass Guard', '', '', 11),
  ('Sweep', '', '', 12),
  ('Take Back', '', '', 13),
  ('Mount', '', '', 14),
  ('Escape', '', '', 15),
  ('Submit', '', '', 16);
