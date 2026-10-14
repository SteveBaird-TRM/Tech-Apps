-- From the Supabase advisors (14 October 2026).

-- 1. SECURITY DEFINER functions were callable by anon through /rest/v1/rpc.
--    The two helpers are used inside RLS policies, so signed-in users keep
--    EXECUTE.  rls_auto_enable is an event trigger and needs no API access.
revoke execute on function public.has_project_access(text, text) from public, anon;
grant execute on function public.has_project_access(text, text) to authenticated;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. RLS: evaluate auth.uid() once per query, not once per row.
alter policy "projects select by related app access" on public.projects
  using (exists (
    select 1 from public.project_access pa
    where pa.user_id = (select auth.uid())
      and pa.project_key = any (array['intake', 'roadmap-db', 'schedule-a-db-v2'])
  ));

alter policy "projects insert by related app editors" on public.projects
  with check (exists (
    select 1 from public.project_access pa
    where pa.user_id = (select auth.uid())
      and pa.project_key = any (array['intake', 'roadmap-db', 'schedule-a-db-v2'])
      and pa.role = 'editor'
  ));

alter policy "projects update by related app editors" on public.projects
  using (exists (
    select 1 from public.project_access pa
    where pa.user_id = (select auth.uid())
      and pa.project_key = any (array['intake', 'roadmap-db', 'schedule-a-db-v2'])
      and pa.role = 'editor'
  ))
  with check (exists (
    select 1 from public.project_access pa
    where pa.user_id = (select auth.uid())
      and pa.project_key = any (array['intake', 'roadmap-db', 'schedule-a-db-v2'])
      and pa.role = 'editor'
  ));

alter policy "project_comments insert by source app editors" on public.project_comments
  with check (
    public.has_project_access(source_app, 'editor')
    and created_by = (select auth.uid())
  );

-- 3. project_access had two permissive SELECT policies.  Merge into one:
--    widen "self read" to include the admin check, then drop the admin one.
alter policy "project_access self read" on public.project_access
  using (user_id = (select auth.uid()) or (select public.is_app_admin()));

drop policy if exists "project_access admin read all" on public.project_access;

-- 4. Missing foreign key indexes.
create index if not exists projects_created_by_idx on public.projects (created_by);
create index if not exists project_comments_created_by_idx on public.project_comments (created_by);
