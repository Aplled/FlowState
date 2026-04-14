-- Add a settings JSON column to profiles so theme + layout preferences
-- follow the user across devices.

alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;
