-- Taxonomy tables: global positions and condition groups
-- Run this in the Supabase SQL Editor after supabase-schema.sql

-- Positions (e.g., "Half Guard", "Mount")
create table positions (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  role_a text not null default 'A',
  role_b text not null default 'B',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Condition groups (e.g., "Near Arm", "Head Control")
create table condition_groups (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Condition options within a group (e.g., "underhook", "overhook")
create table condition_options (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references condition_groups(id) on delete cascade,
  label text not null,
  gi_only boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, label)
);

create index idx_condition_options_group on condition_options (group_id);

-- Seed positions
insert into positions (name, role_a, role_b, sort_order) values
  ('Closed Guard', 'Bottom', 'Top', 0),
  ('Open Guard', 'Bottom', 'Top', 1),
  ('Half Guard', 'Bottom', 'Top', 2),
  ('Deep Half Guard', 'Bottom', 'Top', 3),
  ('Butterfly Guard', 'Bottom', 'Top', 4),
  ('De La Riva', 'Guard', 'Passer', 5),
  ('Reverse De La Riva', 'Guard', 'Passer', 6),
  ('Spider Guard', 'Guard', 'Passer', 7),
  ('Lasso Guard', 'Guard', 'Passer', 8),
  ('X Guard', 'Bottom', 'Top', 9),
  ('Single Leg X', 'Bottom', 'Top', 10),
  ('Rubber Guard', 'Bottom', 'Top', 11),
  ('Mount', 'Top', 'Bottom', 12),
  ('Back Mount', 'Back', 'Turtle', 13),
  ('Side Control', 'Top', 'Bottom', 14),
  ('North-South', 'Top', 'Bottom', 15),
  ('Knee on Belly', 'Top', 'Bottom', 16),
  ('Turtle', 'Turtle', 'Top', 17),
  ('Standing', 'Attacker', 'Defender', 18),
  ('Single Leg', 'Attacker', 'Defender', 19),
  ('Double Leg', 'Attacker', 'Defender', 20);

-- Seed condition groups and options
-- Helper: insert group, then its options

-- Near Arm
with g as (insert into condition_groups (id, name, sort_order) values ('near_arm', 'Near Arm', 0) returning id)
insert into condition_options (group_id, label, sort_order) select g.id, v.label, v.ord from g, (values ('underhook', 0), ('overhook', 1), ('whizzer', 2)) as v(label, ord);

-- Far Arm
with g as (insert into condition_groups (id, name, sort_order) values ('far_arm', 'Far Arm', 1) returning id)
insert into condition_options (group_id, label, sort_order) select g.id, v.label, v.ord from g, (values ('underhook', 0), ('overhook', 1), ('cross grip', 2)) as v(label, ord);

-- Head Control
with g as (insert into condition_groups (id, name, sort_order) values ('head_control', 'Head Control', 2) returning id)
insert into condition_options (group_id, label, sort_order) select g.id, v.label, v.ord from g, (values ('crossface', 0), ('head control', 1), ('no head control', 2)) as v(label, ord);

-- Legs
with g as (insert into condition_groups (id, name, sort_order) values ('legs', 'Legs', 3) returning id)
insert into condition_options (group_id, label, sort_order) select g.id, v.label, v.ord from g, (values ('knee shield', 0), ('lockdown', 1), ('half guard hook', 2), ('butterfly hooks', 3)) as v(label, ord);

-- Near Hand Grip
with g as (insert into condition_groups (id, name, sort_order) values ('near_hand_grip', 'Near Hand Grip', 4) returning id)
insert into condition_options (group_id, label, gi_only, sort_order) select g.id, v.label, v.gi, v.ord from g, (values ('collar grip', true, 0), ('sleeve grip', true, 1), ('pant grip', true, 2), ('belt grip', true, 3), ('wrist grip', false, 4)) as v(label, gi, ord);

-- Far Hand Grip
with g as (insert into condition_groups (id, name, sort_order) values ('far_hand_grip', 'Far Hand Grip', 5) returning id)
insert into condition_options (group_id, label, gi_only, sort_order) select g.id, v.label, v.gi, v.ord from g, (values ('collar grip', true, 0), ('sleeve grip', true, 1), ('pant grip', true, 2), ('belt grip', true, 3), ('wrist grip', false, 4)) as v(label, gi, ord);

-- Posture
with g as (insert into condition_groups (id, name, sort_order) values ('posture', 'Posture', 6) returning id)
insert into condition_options (group_id, label, sort_order) select g.id, v.label, v.ord from g, (values ('postured up', 0), ('broken down', 1)) as v(label, ord);

-- Weight
with g as (insert into condition_groups (id, name, sort_order) values ('weight', 'Weight', 7) returning id)
insert into condition_options (group_id, label, sort_order) select g.id, v.label, v.ord from g, (values ('heavy pressure', 0), ('light/floating', 1), ('driving forward', 2)) as v(label, ord);
