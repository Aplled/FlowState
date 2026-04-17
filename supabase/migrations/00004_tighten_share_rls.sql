-- Tighten RLS for shared-folder access.
-- Prior policies used FOR ALL with only a USING clause, which leaves INSERT
-- unchecked and allows a shared editor to write rows into workspaces or
-- folders they do not actually share. Re-create each policy with explicit
-- USING and WITH CHECK clauses scoped to the shared folder.

-- ============================================================
-- NODES
-- ============================================================
drop policy if exists "Shared editors can manage nodes" on public.nodes;

create policy "Shared editors can manage nodes"
  on public.nodes for all using (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid() and fs.permission in ('edit', 'admin')
    )
  ) with check (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid() and fs.permission in ('edit', 'admin')
    )
  );

-- ============================================================
-- CONNECTIONS
-- ============================================================
drop policy if exists "Shared editors can manage connections" on public.connections;

create policy "Shared editors can manage connections"
  on public.connections for all using (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid() and fs.permission in ('edit', 'admin')
    )
  ) with check (
    workspace_id in (
      select w.id from public.workspaces w
      join public.folder_shares fs on fs.folder_id = w.folder_id
      where fs.shared_with_id = auth.uid() and fs.permission in ('edit', 'admin')
    )
  );

-- ============================================================
-- WORKSPACES
-- ============================================================
drop policy if exists "Shared editors can manage workspaces" on public.workspaces;

create policy "Shared editors can manage workspaces"
  on public.workspaces for all using (
    folder_id in (
      select folder_id from public.folder_shares
      where shared_with_id = auth.uid() and permission in ('edit', 'admin')
    )
  ) with check (
    folder_id in (
      select folder_id from public.folder_shares
      where shared_with_id = auth.uid() and permission in ('edit', 'admin')
    )
    and owner_id = auth.uid()
  );

-- ============================================================
-- FOLDER SHARES
-- ============================================================
-- Existing "Folder owners can manage shares" has no WITH CHECK, so an owner
-- of one folder could insert a share row for a folder they do not own.
drop policy if exists "Folder owners can manage shares" on public.folder_shares;

create policy "Folder owners can manage shares"
  on public.folder_shares for all using (
    auth.uid() in (
      select owner_id from public.folders where id = folder_id
    )
  ) with check (
    auth.uid() in (
      select owner_id from public.folders where id = folder_id
    )
  );

-- Recipients may remove their own share row (revoke access for themselves),
-- but must not be able to re-point it to a different folder or user.
create policy "Recipients can delete own share"
  on public.folder_shares for delete using (
    auth.uid() = shared_with_id
  );
