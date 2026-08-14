revoke execute on function public.get_vendor_financial_summary(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.get_platform_financial_summary(timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.get_university_gmv_rankings(timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.get_vendor_sales_trend(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.get_platform_subsidies(timestamptz, timestamptz, uuid) from public, anon, authenticated;

grant execute on function public.get_vendor_financial_summary(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.get_platform_financial_summary(timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.get_university_gmv_rankings(timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.get_vendor_sales_trend(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.get_platform_subsidies(timestamptz, timestamptz, uuid) to service_role;
