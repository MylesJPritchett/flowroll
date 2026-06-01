-- Separate named graphs per user (flows, snippets, etc.)
create table if not exists graphs (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  name text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_graphs_user on graphs (user_id);

-- Link nodes and edges to a specific graph (null = main workspace)
alter table graph_nodes add column if not exists graph_id text references graphs(id) on delete cascade;
alter table graph_edges add column if not exists graph_id text references graphs(id) on delete cascade;

create index if not exists idx_graph_nodes_graph on graph_nodes (graph_id);
create index if not exists idx_graph_edges_graph on graph_edges (graph_id);
