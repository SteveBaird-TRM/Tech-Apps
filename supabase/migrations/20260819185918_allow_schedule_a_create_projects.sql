-- schedule-a was originally link-only (see 20260819155600_create_projects_registry.sql),
-- but its Add-resource picker now needs to create a project when nothing
-- matches, same as intake/roadmap. Widen the origin_app check and the
-- insert policy to include schedule-a-db-v2.

alter table public.projects drop constraint projects_origin_app_check;
alter table public.projects add constraint projects_origin_app_check
  check (origin_app in ('intake', 'roadmap-db', 'schedule-a-db-v2'));

drop policy if exists "projects insert by intake/roadmap editors" on public.projects;
create policy "projects insert by related app editors"
  on public.projects
  for insert
  with check (
    exists (
      select 1 from public.project_access
      where user_id = auth.uid()
        and project_key in ('intake', 'roadmap-db', 'schedule-a-db-v2')
        and role = 'editor'
    )
  );
