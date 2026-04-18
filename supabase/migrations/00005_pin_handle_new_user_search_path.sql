-- handle_new_user() is SECURITY DEFINER, which means it runs with the
-- privileges of the role that owns it (postgres). Without a pinned
-- search_path, a role that can create objects in any earlier-in-the-path
-- schema could shadow `public.profiles` and intercept new-user inserts.
-- On Supabase this exploitability is low (users don't have CREATE on other
-- schemas), but Supabase's own linter flags it as `function_search_path_mutable`
-- and it's a one-line fix.
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
$$ language plpgsql security definer set search_path = public;
