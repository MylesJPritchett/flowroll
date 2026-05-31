-- Maps which individual condition options are available per position + role
-- If no rows exist for a position+role, ALL options are available (permissive default)
-- Run this after supabase-taxonomy.sql

create table position_conditions (
  id text primary key default gen_random_uuid()::text,
  position_id text not null references positions(id) on delete cascade,
  condition_option_id text not null references condition_options(id) on delete cascade,
  role text not null check (role in ('A', 'B')),
  unique (position_id, condition_option_id, role)
);

create index idx_pc_position on position_conditions (position_id);

-- Seed: for each position, allow all condition options for both roles by default
-- Admins can then remove the ones that don't apply
insert into position_conditions (position_id, condition_option_id, role)
select p.id, co.id, r.role
from positions p
cross join condition_options co
cross join (values ('A'), ('B')) as r(role);
