-- 20260819155600_create_projects_registry.sql granted authenticated only
-- select/insert/update on public.projects, even though it also added a
-- delete RLS policy (admin only, via is_app_admin()). RLS policies aren't
-- consulted until the base GRANT allows the operation, so admin deletes from
-- the projects admin UI were rejected with a permissions error despite the
-- policy being correct.

grant delete on public.projects to authenticated;
