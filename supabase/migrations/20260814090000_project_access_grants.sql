-- project_access was created by hand outside of migrations and never got
-- the standard Supabase table grants, only the RLS policies from
-- 20260813120000_admin_access_control.sql. RLS restricts which rows a role
-- can touch, but the role still needs a base GRANT to touch the table at
-- all — without it, every query fails with "permission denied for table
-- project_access" regardless of RLS. This was breaking:
--   - the admin-users edge function (runs as service_role, had no grants)
--   - the admin page's role-toggle dropdowns (write directly as
--     authenticated via the browser client, only had SELECT)

grant select, insert, update, delete, truncate on public.project_access to service_role;
grant insert, update, delete on public.project_access to authenticated;
