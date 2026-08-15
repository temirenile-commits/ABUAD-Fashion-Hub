create table if not exists public.miles_configurations (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('GLOBAL','UNIVERSITY','ROLE','USER')),
  user_id uuid references public.users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete cascade,
  role_key text,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint miles_configurations_scope_shape check (
    (scope_type = 'GLOBAL' and user_id is null and university_id is null and role_key is null)
    or (scope_type = 'UNIVERSITY' and university_id is not null and user_id is null and role_key is null)
    or (scope_type = 'ROLE' and role_key is not null and user_id is null and university_id is null)
    or (scope_type = 'USER' and user_id is not null and university_id is null and role_key is null)
  )
);

create unique index if not exists miles_configurations_global_idx on public.miles_configurations(scope_type) where scope_type = 'GLOBAL';
create unique index if not exists miles_configurations_university_idx on public.miles_configurations(university_id) where scope_type = 'UNIVERSITY';
create unique index if not exists miles_configurations_role_idx on public.miles_configurations(role_key) where scope_type = 'ROLE';
create unique index if not exists miles_configurations_user_idx on public.miles_configurations(user_id) where scope_type = 'USER';
create index if not exists miles_configurations_scope_idx on public.miles_configurations(scope_type, updated_at desc);

create table if not exists public.miles_configuration_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('GLOBAL','UNIVERSITY','ROLE','USER')),
  user_id uuid references public.users(id) on delete set null,
  university_id uuid references public.universities(id) on delete set null,
  role_key text,
  setting_changed text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists miles_configuration_audit_scope_idx on public.miles_configuration_audit(scope_type, created_at desc);
create index if not exists miles_configuration_audit_actor_idx on public.miles_configuration_audit(actor_id, created_at desc);

alter table public.miles_configurations enable row level security;
alter table public.miles_configuration_audit enable row level security;
revoke all on public.miles_configurations from anon, authenticated;
revoke all on public.miles_configuration_audit from anon, authenticated;

create or replace function public.touch_miles_configurations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;
drop trigger if exists miles_configurations_touch on public.miles_configurations;
create trigger miles_configurations_touch before update on public.miles_configurations for each row execute function public.touch_miles_configurations();

insert into public.miles_configurations (scope_type, config, reason)
values ('GLOBAL', jsonb_build_object(
  'identity', jsonb_build_object('name', 'Miles', 'personalizationAllowed', true),
  'permissions', jsonb_build_object('readEnabled', true, 'writeEnabled', false),
  'assistance', jsonb_build_object('proactiveEnabled', true, 'notificationsEnabled', true, 'tourGuideEnabled', true),
  'capabilities', jsonb_build_object(
    'products', jsonb_build_object('read', true, 'write', true),
    'orders', jsonb_build_object('read', true, 'write', false),
    'finance', jsonb_build_object('read', true, 'write', false),
    'payouts', jsonb_build_object('read', true, 'write', false),
    'users', jsonb_build_object('read', false, 'write', false),
    'vendors', jsonb_build_object('read', true, 'write', false),
    'support', jsonb_build_object('read', true, 'write', false),
    'analytics', jsonb_build_object('read', true, 'write', false),
    'university', jsonb_build_object('read', false, 'write', false)
  ),
  'safety', jsonb_build_object('confirmationRequiredForHighRisk', true, 'financialSourceOfTruth', 'mastercart_backend')
), 'Initial global Miles configuration')
on conflict do nothing;

notify pgrst, 'reload schema';
