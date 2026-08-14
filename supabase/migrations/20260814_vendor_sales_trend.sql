create or replace function public.get_vendor_sales_trend(
  p_brand_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  day date,
  gross_sales numeric,
  vendor_earnings numeric,
  order_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    date_trunc('day', o.created_at)::date as day,
    coalesce(sum(o.total_amount), 0)::numeric as gross_sales,
    coalesce(sum(o.vendor_earning), 0)::numeric as vendor_earnings,
    count(*)::bigint as order_count
  from public.orders o
  where o.brand_id = p_brand_id
    and o.created_at >= p_start
    and o.created_at < p_end
    and o.status in ('paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received')
  group by date_trunc('day', o.created_at)::date
  order by day asc;
$$;

revoke all on function public.get_vendor_sales_trend(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_vendor_sales_trend(uuid, timestamptz, timestamptz) to service_role;
