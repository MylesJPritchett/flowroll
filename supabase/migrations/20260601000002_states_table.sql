-- Named states: reusable position + conditions presets (e.g. "High Mount" = Mount with specific conditions)
create table if not exists states (
  id text primary key default gen_random_uuid()::text,
  position_id text not null references positions(id) on delete cascade,
  name text not null,
  description text not null default '',
  conditions jsonb not null default '[]',
  gi_nogi text not null default '' check (gi_nogi in ('', 'gi', 'nogi')),
  sort_order int not null default 0,
  created_by text,
  is_official boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_states_position on states (position_id);
