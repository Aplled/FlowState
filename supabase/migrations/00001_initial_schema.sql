-- FlowState Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FOLDERS
-- ============================================================
create table public.folders (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  color text,
  icon text,
  sort_order integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_folders_owner on public.folders(owner_id);
create index idx_folders_parent on public.folders(parent_id);

alter table public.folders enable row level security;

create policy "Users can manage own folders"
  on public.folders for all using (auth.uid() = owner_id);

-- ============================================================
-- FOLDER SHARES
-- ============================================================
create table public.folder_shares (
  id uuid default uuid_generate_v4() primary key,
  folder_id uuid references public.folders(id) on delete cascade not null,
  shared_with_id uuid references public.profiles(id) on delete cascade not null,
  permission text check (permission in ('view', 'edit', 'admin')) default 'view' not null,
  created_at timestamptz default now() not null,
  unique(folder_id, shared_with_id)
);

alter table public.folder_shares enable row level security;

create policy "Folder owners can manage shares"
  on public.folder_shares for all using (
    auth.uid() in (
      select owner_id from public.folders where id = folder_id
    )
  );

create policy "Shared users can view their shares"
  on public.folder_shares for select using (auth.uid() = shared_with_id);

-- ============================================================
-- WORKSPACES (Dynamic Tabs)
-- ============================================================
create table public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  folder_id uuid references public.folders(id) on delete cascade not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  sort_order integer default 0 not null,
  viewport_x double precision default 0 not null,
  viewport_y double precision default 0 not null,
  viewport_zoom double precision default 1 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_workspaces_folder on public.workspaces(folder_id);
create index idx_workspaces_owner on public.workspaces(owner_id);

alter table public.workspaces enable row level security;

create policy "Users can manage own workspaces"
  on public.workspaces for all using (auth.uid() = owner_id);

create policy "Shared folder users can access workspaces"
  on public.workspaces for select using (
    folder_id in (
      select folder_id from public.folder_shares where shared_with_id = auth.uid()
    )
  );

-- ============================================================
-- NODES
-- ============================================================
create table public.nodes (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  type text check (type in ('task', 'note', 'doc', 'table', 'event', 'browser', 'draw', 'tab', 'grouple')) not null,
  position_x double precision default 0 not null,
  position_y double precision default 0 not null,
  width double precision default 280 not null,
  height double precision default 180 not null,
  data jsonb default '{}'::jsonb not null,
  parent_id uuid references public.nodes(id) on delete set null,
  is_locked boolean default false not null,
  is_expanded boolean default false not null,
  z_index integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_nodes_workspace on public.nodes(workspace_id);
create index idx_nodes_type on public.nodes(type);
create index idx_nodes_parent on public.nodes(parent_id);

alter table public.nodes enable row level security;

create policy "Users can manage nodes in own workspaces"
  on public.nodes for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "Shared users can view nodes"
  on public.nodes for select using (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid()
    )
  );

-- ============================================================
-- CONNECTIONS (Edges)
-- ============================================================
create table public.connections (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  source_node_id uuid references public.nodes(id) on delete cascade not null,
  target_node_id uuid references public.nodes(id) on delete cascade not null,
  label text,
  style text check (style in ('solid', 'dashed', 'dotted')) default 'solid' not null,
  is_directed boolean default true not null,
  weight double precision,
  created_at timestamptz default now() not null
);

create index idx_connections_workspace on public.connections(workspace_id);
create index idx_connections_source on public.connections(source_node_id);
create index idx_connections_target on public.connections(target_node_id);

alter table public.connections enable row level security;

create policy "Users can manage connections in own workspaces"
  on public.connections for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

-- ============================================================
-- AUTO SORT BUCKET (ASB)
-- ============================================================
create table public.asb_items (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  node_id uuid references public.nodes(id) on delete cascade not null,
  suggested_workspace_id uuid references public.workspaces(id) on delete set null,
  suggested_folder_id uuid references public.folders(id) on delete set null,
  confidence double precision default 0 not null,
  sort_mode text check (sort_mode in ('suggest', 'auto', 'manual')) default 'suggest' not null,
  is_sorted boolean default false not null,
  created_at timestamptz default now() not null
);

create index idx_asb_owner on public.asb_items(owner_id);

alter table public.asb_items enable row level security;

create policy "Users can manage own ASB items"
  on public.asb_items for all using (auth.uid() = owner_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger update_folders_updated_at before update on public.folders
  for each row execute procedure public.update_updated_at();

create trigger update_workspaces_updated_at before update on public.workspaces
  for each row execute procedure public.update_updated_at();

create trigger update_nodes_updated_at before update on public.nodes
  for each row execute procedure public.update_updated_at();

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table public.nodes;
alter publication supabase_realtime add table public.connections;
alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.folders;
