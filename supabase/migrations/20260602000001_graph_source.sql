-- Track how a flow/graph was created: 'user', 'import', or 'merge'
alter table graphs add column if not exists source text not null default 'user' check (source in ('user', 'import', 'merge'));
