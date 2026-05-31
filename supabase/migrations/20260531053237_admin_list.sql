create table if not exists admins (
  email text primary key
);

insert into admins (email) values ('mylesjpritchett@gmail.com') on conflict do nothing;
