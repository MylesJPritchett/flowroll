-- Initial schema: graph storage, taxonomy, actions, position conditions,
-- ownership, prerequisites, and action effects.
--
-- This consolidates all previous migration scripts into one baseline.
-- If running against a fresh database, execute this file once.
-- If your database already has all tables, skip this and start from the next migration.

-- ============================================================
-- 1. User graph data
-- ============================================================

create table if not exists graph_nodes (
  id text not null,
  user_id text not null,
  label text not null default 'New Node',
  description text not null default '',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists graph_edges (
  id text not null,
  user_id text not null,
  source_node_id text not null,
  target_node_id text not null,
  relationship text not null default '',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

create index if not exists idx_graph_nodes_user on graph_nodes (user_id);
create index if not exists idx_graph_edges_user on graph_edges (user_id);

-- ============================================================
-- 2. Taxonomy: positions
-- ============================================================

create table if not exists positions (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  role_a text not null default 'A',
  role_b text not null default 'B',
  sort_order int not null default 0,
  created_by text,
  is_official boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Taxonomy: condition groups + options
-- ============================================================

create table if not exists condition_groups (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  sort_order int not null default 0,
  created_by text,
  is_official boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists condition_options (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references condition_groups(id) on delete cascade,
  label text not null,
  gi_only boolean not null default false,
  sort_order int not null default 0,
  created_by text,
  is_official boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, label)
);

create index if not exists idx_condition_options_group on condition_options (group_id);

-- ============================================================
-- 4. Taxonomy: actions
-- ============================================================

create table if not exists actions (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  gi_nogi text not null default '' check (gi_nogi in ('', 'gi', 'nogi')),
  sort_order int not null default 0,
  created_by text,
  is_official boolean not null default false,
  is_public boolean not null default true,
  required_conditions jsonb not null default '[]',
  forbidden_conditions jsonb not null default '[]',
  adds_conditions jsonb not null default '[]',
  removes_conditions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. Position → condition option mappings (which conditions are possible per position+role)
-- ============================================================

create table if not exists position_conditions (
  id text primary key default gen_random_uuid()::text,
  position_id text not null references positions(id) on delete cascade,
  condition_option_id text not null references condition_options(id) on delete cascade,
  role text not null check (role in ('A', 'B')),
  unique (position_id, condition_option_id, role)
);

create index if not exists idx_pc_position on position_conditions (position_id);

-- ============================================================
-- 6. Position requirements (conditions that MUST be present for a position)
-- ============================================================

create table if not exists position_requirements (
  id text primary key default gen_random_uuid()::text,
  position_id text not null references positions(id) on delete cascade,
  condition_option_id text not null references condition_options(id) on delete cascade,
  role text not null check (role in ('A', 'B')),
  unique (position_id, condition_option_id, role)
);

create index if not exists idx_pos_req_position on position_requirements (position_id);

-- ============================================================
-- 7. Seed data
-- ============================================================

-- Positions
insert into positions (name, role_a, role_b, sort_order, is_official) values
  ('Closed Guard', 'Bottom', 'Top', 0, true),
  ('Open Guard', 'Bottom', 'Top', 1, true),
  ('Half Guard', 'Bottom', 'Top', 2, true),
  ('Deep Half Guard', 'Bottom', 'Top', 3, true),
  ('Butterfly Guard', 'Bottom', 'Top', 4, true),
  ('De La Riva', 'Guard', 'Passer', 5, true),
  ('Reverse De La Riva', 'Guard', 'Passer', 6, true),
  ('Spider Guard', 'Guard', 'Passer', 7, true),
  ('Lasso Guard', 'Guard', 'Passer', 8, true),
  ('X Guard', 'Bottom', 'Top', 9, true),
  ('Single Leg X', 'Bottom', 'Top', 10, true),
  ('Rubber Guard', 'Bottom', 'Top', 11, true),
  ('Mount', 'Top', 'Bottom', 12, true),
  ('Back Mount', 'Back', 'Turtle', 13, true),
  ('Side Control', 'Top', 'Bottom', 14, true),
  ('North-South', 'Top', 'Bottom', 15, true),
  ('Knee on Belly', 'Top', 'Bottom', 16, true),
  ('Turtle', 'Turtle', 'Top', 17, true),
  ('Standing', 'Attacker', 'Defender', 18, true),
  ('Single Leg', 'Attacker', 'Defender', 19, true),
  ('Double Leg', 'Attacker', 'Defender', 20, true)
on conflict (name) do nothing;

-- Condition groups + options
-- Near Arm
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('near_arm', 'Near Arm', 0, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, sort_order, is_official) select g.id, v.label, v.ord, true from g, (values ('underhook', 0), ('overhook', 1), ('whizzer', 2)) as v(label, ord) on conflict (group_id, label) do nothing;

-- Far Arm
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('far_arm', 'Far Arm', 1, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, sort_order, is_official) select g.id, v.label, v.ord, true from g, (values ('underhook', 0), ('overhook', 1), ('cross grip', 2)) as v(label, ord) on conflict (group_id, label) do nothing;

-- Head Control
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('head_control', 'Head Control', 2, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, sort_order, is_official) select g.id, v.label, v.ord, true from g, (values ('crossface', 0), ('head control', 1), ('no head control', 2)) as v(label, ord) on conflict (group_id, label) do nothing;

-- Legs
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('legs', 'Legs', 3, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, sort_order, is_official) select g.id, v.label, v.ord, true from g, (values ('knee shield', 0), ('lockdown', 1), ('half guard hook', 2), ('butterfly hooks', 3)) as v(label, ord) on conflict (group_id, label) do nothing;

-- Near Hand Grip
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('near_hand_grip', 'Near Hand Grip', 4, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, gi_only, sort_order, is_official) select g.id, v.label, v.gi, v.ord, true from g, (values ('collar grip', true, 0), ('sleeve grip', true, 1), ('pant grip', true, 2), ('belt grip', true, 3), ('wrist grip', false, 4)) as v(label, gi, ord) on conflict (group_id, label) do nothing;

-- Far Hand Grip
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('far_hand_grip', 'Far Hand Grip', 5, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, gi_only, sort_order, is_official) select g.id, v.label, v.gi, v.ord, true from g, (values ('collar grip', true, 0), ('sleeve grip', true, 1), ('pant grip', true, 2), ('belt grip', true, 3), ('wrist grip', false, 4)) as v(label, gi, ord) on conflict (group_id, label) do nothing;

-- Posture
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('posture', 'Posture', 6, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, sort_order, is_official) select g.id, v.label, v.ord, true from g, (values ('postured up', 0), ('broken down', 1)) as v(label, ord) on conflict (group_id, label) do nothing;

-- Weight
with g as (insert into condition_groups (id, name, sort_order, is_official) values ('weight', 'Weight', 7, true) on conflict (id) do nothing returning id)
insert into condition_options (group_id, label, sort_order, is_official) select g.id, v.label, v.ord, true from g, (values ('heavy pressure', 0), ('light/floating', 1), ('driving forward', 2)) as v(label, ord) on conflict (group_id, label) do nothing;

-- Actions
insert into actions (name, description, gi_nogi, sort_order, is_official) values
  ('Get Underhook', '', '', 0, true),
  ('Pummel', '', '', 1, true),
  ('Hip Escape', '', '', 2, true),
  ('Bridge', '', '', 3, true),
  ('Frame', '', '', 4, true),
  ('Strip Grip', '', '', 5, true),
  ('Get Collar Grip', '', 'gi', 6, true),
  ('Get Sleeve Grip', '', 'gi', 7, true),
  ('Get Wrist Control', '', '', 8, true),
  ('Knee Shield Insert', '', '', 9, true),
  ('Reguard', '', '', 10, true),
  ('Pass Guard', '', '', 11, true),
  ('Sweep', '', '', 12, true),
  ('Take Back', '', '', 13, true),
  ('Mount', '', '', 14, true),
  ('Escape', '', '', 15, true),
  ('Submit', '', '', 16, true)
on conflict do nothing;

-- Seed position_conditions: all positions × all options × both roles
insert into position_conditions (position_id, condition_option_id, role)
select p.id, co.id, r.role
from positions p
cross join condition_options co
cross join (values ('A'), ('B')) as r(role)
on conflict (position_id, condition_option_id, role) do nothing;
