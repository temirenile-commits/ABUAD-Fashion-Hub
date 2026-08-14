create table if not exists public.miles_controlled_actions (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null unique,
  actor_id uuid not null references public.users(id) on delete cascade,
  actor_role text not null,
  action_type text not null,
  target_resource text not null,
  target_resource_id uuid not null,
  permission_requirement text not null,
  scope_requirement text,
  confirmation_required boolean not null default true,
  confirmation_status text not null check (confirmation_status in ('pending', 'confirmed', 'expired', 'rejected')) default 'pending',
  execution_status text not null check (execution_status in ('pending', 'executed', 'failed')) default 'pending',
  payload jsonb not null default '{}'::jsonb,
  previous_state jsonb,
  resulting_state jsonb,
  result_summary text,
  request_hash text not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists miles_controlled_actions_actor_idx
  on public.miles_controlled_actions(actor_id, created_at desc);
create index if not exists miles_controlled_actions_target_idx
  on public.miles_controlled_actions(target_resource, target_resource_id, created_at desc);
create index if not exists miles_controlled_actions_expiry_idx
  on public.miles_controlled_actions(expires_at);

alter table public.miles_controlled_actions enable row level security;
revoke all on public.miles_controlled_actions from anon, authenticated;
