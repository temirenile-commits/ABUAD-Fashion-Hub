alter table public.vendor_ai_settings
  add column if not exists store_access_enabled boolean not null default false,
  add column if not exists store_write_enabled boolean not null default false,
  add column if not exists sensitive_action_confirmation_required boolean not null default true,
  add column if not exists access_activated_at timestamptz,
  add column if not exists access_activated_by uuid references public.users(id);

update public.vendor_ai_settings
set sensitive_action_confirmation_required = true
where sensitive_action_confirmation_required is null;

notify pgrst, 'reload schema';
