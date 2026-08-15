create table if not exists public.miles_onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_key text not null default 'customer',
  onboarding_version integer not null default 1,
  onboarding_started boolean not null default false,
  current_step integer not null default 0,
  completed boolean not null default false,
  skipped boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.miles_onboarding_progress enable row level security;

drop policy if exists "users can read own Miles onboarding progress" on public.miles_onboarding_progress;
create policy "users can read own Miles onboarding progress"
  on public.miles_onboarding_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own Miles onboarding progress" on public.miles_onboarding_progress;
create policy "users can insert own Miles onboarding progress"
  on public.miles_onboarding_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own Miles onboarding progress" on public.miles_onboarding_progress;
create policy "users can update own Miles onboarding progress"
  on public.miles_onboarding_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists miles_onboarding_progress_updated_idx
  on public.miles_onboarding_progress (updated_at desc);

create or replace function public.touch_miles_onboarding_progress()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.last_seen = now();
  return new;
end;
$$;

drop trigger if exists miles_onboarding_progress_touch on public.miles_onboarding_progress;
create trigger miles_onboarding_progress_touch
before update on public.miles_onboarding_progress
for each row execute function public.touch_miles_onboarding_progress();

notify pgrst, 'reload schema';
