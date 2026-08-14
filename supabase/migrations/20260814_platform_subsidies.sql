create or replace function public.get_platform_subsidies(
  p_start timestamptz,
  p_end timestamptz,
  p_university_id uuid default null
)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(o.admin_discount), 0)::numeric
  from public.orders o
  where o.created_at >= p_start
    and o.created_at < p_end
    and o.status in ('paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received')
    and (p_university_id is null or o.university_id = p_university_id);
$$;

revoke all on function public.get_platform_subsidies(timestamptz, timestamptz, uuid) from public;
grant execute on function public.get_platform_subsidies(timestamptz, timestamptz, uuid) to service_role;
