create table if not exists public.miles_action_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  action_type text not null,
  status text not null check (status in ('proposed', 'confirmed', 'executed', 'rejected', 'expired', 'failed')),
  request_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  result_summary text,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists miles_action_audit_user_brand_idx
  on public.miles_action_audit(user_id, brand_id, created_at desc);

create index if not exists miles_action_audit_expiry_idx
  on public.miles_action_audit(expires_at);

alter table public.miles_action_audit enable row level security;
revoke all on public.miles_action_audit from anon, authenticated;
