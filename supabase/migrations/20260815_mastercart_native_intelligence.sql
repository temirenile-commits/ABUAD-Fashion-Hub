create extension if not exists pgcrypto;

create table if not exists public.miles_native_knowledge (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  title text not null,
  statement text not null,
  source text not null,
  status text not null default 'proposed' check (status in ('proposed','validating','verified','active','deprecated')),
  confidence numeric(5,4) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  expires_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);

create index if not exists miles_native_knowledge_active_idx on public.miles_native_knowledge (status, domain, confidence desc, last_verified_at desc);
create index if not exists miles_native_knowledge_expiry_idx on public.miles_native_knowledge (expires_at) where expires_at is not null;

create table if not exists public.miles_reasoning_patterns (
  id uuid primary key default gen_random_uuid(),
  problem_type text not null,
  pattern text not null,
  required_checks jsonb not null default '[]'::jsonb,
  source text not null,
  status text not null default 'proposed' check (status in ('proposed','validating','verified','active','deprecated')),
  confidence numeric(5,4) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  version integer not null default 1 check (version > 0),
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  expires_at timestamptz
);

create index if not exists miles_reasoning_patterns_idx on public.miles_reasoning_patterns (status, problem_type, confidence desc, use_count desc);

create table if not exists public.miles_tool_intelligence (
  id uuid primary key default gen_random_uuid(),
  intent text not null,
  problem_type text,
  tool_name text not null,
  rank integer not null default 1,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists miles_tool_intelligence_unique_idx on public.miles_tool_intelligence (intent, coalesce(problem_type, ''), tool_name);
create index if not exists miles_tool_intelligence_lookup_idx on public.miles_tool_intelligence (intent, rank, success_count desc);

create table if not exists public.miles_learning_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('interaction','tool_usage','provider_outcome','workflow_success','workflow_failure','repeated_question','knowledge_candidate')),
  intent text,
  domain text,
  sanitized_input text,
  sanitized_output text,
  generalized_summary text,
  provider_name text,
  provider_model text,
  outcome text,
  tool_names jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists miles_learning_events_lookup_idx on public.miles_learning_events (event_type, intent, domain, created_at desc);

create table if not exists public.miles_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_type text not null check (feedback_type in ('rating','correction','success','failure','admin_correction','tool_failure','workflow_success')),
  rating smallint check (rating is null or (rating between 1 and 5)),
  sanitized_message text,
  sanitized_correction text,
  intent text,
  source text not null default 'user',
  status text not null default 'proposed' check (status in ('proposed','validating','verified','active','deprecated')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists miles_feedback_review_idx on public.miles_feedback (status, created_at desc);

create table if not exists public.miles_provider_comparisons (
  id uuid primary key default gen_random_uuid(),
  comparison_key text not null,
  intent text,
  sanitized_problem text not null,
  provider_outputs jsonb not null default '[]'::jsonb,
  validation_result jsonb not null default '{}'::jsonb,
  selected_provider text,
  selected_summary text,
  status text not null default 'proposed' check (status in ('proposed','validating','verified','active','deprecated')),
  created_at timestamptz not null default now(),
  last_verified_at timestamptz
);

create index if not exists miles_provider_comparisons_idx on public.miles_provider_comparisons (comparison_key, created_at desc);

alter table public.miles_native_knowledge enable row level security;
alter table public.miles_reasoning_patterns enable row level security;
alter table public.miles_tool_intelligence enable row level security;
alter table public.miles_learning_events enable row level security;
alter table public.miles_feedback enable row level security;
alter table public.miles_provider_comparisons enable row level security;

revoke all on public.miles_native_knowledge from anon, authenticated;
revoke all on public.miles_reasoning_patterns from anon, authenticated;
revoke all on public.miles_tool_intelligence from anon, authenticated;
revoke all on public.miles_learning_events from anon, authenticated;
revoke all on public.miles_feedback from anon, authenticated;
revoke all on public.miles_provider_comparisons from anon, authenticated;

insert into public.miles_native_knowledge (domain, title, statement, source, status, confidence, last_verified_at)
values
  ('security', 'Backend authority', 'MasterCart backend authentication, authorization, permissions, ownership, and current database state are authoritative over AI output.', 'system', 'active', 1, now()),
  ('privacy', 'Generalized learning only', 'Native learning must remove private identifiers and convert incidents into reusable generalized knowledge.', 'system', 'active', 1, now()),
  ('reels', 'Reel publishing permission', 'Reel publishing requires an authenticated vendor with the appropriate Reel publishing permission and a valid entity state.', 'system', 'active', 0.95, now()),
  ('orders', 'Current order state', 'Order and delivery answers must use current validated MasterCart backend data rather than stale learned memory.', 'system', 'active', 1, now()),
  ('financials', 'Current financial state', 'Wallet, payment, payout, and financial answers must use deterministic backend calculations and current validated data.', 'system', 'active', 1, now())
on conflict do nothing;

insert into public.miles_reasoning_patterns (problem_type, pattern, required_checks, source, status, confidence, last_verified_at)
values
  ('authorization_failure', 'Verify authentication, role, ownership, permission, entity state, database state, recent errors, then determine a correction.', '["authentication","role","ownership","permission","entity_state","database_state","recent_errors","correction"]'::jsonb, 'system', 'active', 0.95, now()),
  ('current_data_question', 'Retrieve current authoritative backend data before explaining the result.', '["current_backend_data","scope","validation","explanation"]'::jsonb, 'system', 'active', 1, now()),
  ('ambiguous_reference', 'Use recent validated result cards; if more than one record can match, ask a clarification question.', '["conversation_memory","result_card_matching","clarification"]'::jsonb, 'system', 'active', 0.95, now())
on conflict do nothing;

insert into public.miles_tool_intelligence (intent, problem_type, tool_name, rank, source)
values
  ('order_query', 'current_order', 'get_customer_orders', 1, 'system'),
  ('order_query', 'current_order', 'get_order_details', 2, 'system'),
  ('delivery_query', 'current_delivery', 'get_customer_orders', 1, 'system'),
  ('reel_query', 'reel_permission', 'get_user_role', 1, 'system'),
  ('reel_query', 'reel_permission', 'get_vendor_profile', 2, 'system'),
  ('reel_query', 'reel_permission', 'get_reel_permissions', 3, 'system'),
  ('reel_query', 'reel_permission', 'get_vendor_reels', 4, 'system'),
  ('reel_query', 'reel_permission', 'get_recent_errors', 5, 'system')
on conflict do nothing;

notify pgrst, 'reload schema';
