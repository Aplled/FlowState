-- Add missing columns and policies

-- Add display_name alias to profiles
alter table public.profiles add column if not exists display_name text;

-- Add parent_workspace_id to workspaces
alter table public.workspaces add column if not exists parent_workspace_id uuid references public.workspaces(id) on delete set null;

-- Add direction column to connections (replacing is_directed)
alter table public.connections add column if not exists direction text check (direction in ('directed', 'undirected', 'bidirectional')) default 'directed' not null;

-- Allow users to read profiles of people who share folders with them
create policy "Users can view shared profiles"
  on public.profiles for select using (
    id in (
      select fs.shared_with_id from public.folder_shares fs
      join public.folders f on f.id = fs.folder_id
      where f.owner_id = auth.uid()
      union
      select f.owner_id from public.folders f
      join public.folder_shares fs on fs.folder_id = f.id
      where fs.shared_with_id = auth.uid()
    )
  );

-- Shared editors can insert/update/delete nodes
create policy "Shared editors can manage nodes"
  on public.nodes for all using (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid() and fs.permission in ('edit', 'admin')
    )
  );

-- Shared editors can manage connections
create policy "Shared users can view connections"
  on public.connections for select using (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid()
    )
  );

create policy "Shared editors can manage connections"
  on public.connections for all using (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid() and fs.permission in ('edit', 'admin')
    )
  );

-- Shared editors can manage workspaces
create policy "Shared editors can manage workspaces"
  on public.workspaces for all using (
    folder_id in (
      select folder_id from public.folder_shares
      where shared_with_id = auth.uid() and permission in ('edit', 'admin')
    )
  );

-- Users can insert their own profile (for signup trigger edge cases)
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Folder read policy for shared users
create policy "Shared users can view folders"
  on public.folders for select using (
    id in (
      select folder_id from public.folder_shares where shared_with_id = auth.uid()
    )
  );
