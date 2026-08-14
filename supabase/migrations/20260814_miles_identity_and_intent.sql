alter table public.vendor_ai_settings
  add column if not exists assistant_name text not null default 'Miles';

notify pgrst, 'reload schema';
