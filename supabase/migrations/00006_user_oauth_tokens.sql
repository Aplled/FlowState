-- Server-stored OAuth provider refresh tokens.
--
-- Supabase's auth service deliberately does NOT persist provider_refresh_token
-- anywhere server-side — it's only exposed in the client session right after
-- the OAuth callback. Since the google-calendar-proxy edge function needs the
-- refresh token to mint access tokens on the user's behalf, the client has to
-- capture it from the session and send it here to be stored.
--
-- Access is service-role only. RLS is enabled with no policies, so nothing
-- authenticated or anonymous can read or write this table directly; only the
-- edge functions (which use service_role) touch it.

create table public.user_oauth_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_oauth_tokens enable row level security;

comment on table public.user_oauth_tokens is
  'Server-stored provider refresh tokens. Service-role only — no RLS policies intentionally.';
