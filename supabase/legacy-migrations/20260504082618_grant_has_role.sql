-- Grant execute on has_role to authenticated and anon so RLS policies can call it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
