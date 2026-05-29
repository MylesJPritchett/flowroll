-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

create table graph_nodes (
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

create table graph_edges (
  id text not null,
  user_id text not null,
  source_node_id text not null,
  target_node_id text not null,
  relationship text not null default 'leads to',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

create index idx_graph_nodes_user on graph_nodes (user_id);
create index idx_graph_edges_user on graph_edges (user_id);
