-- Canonical project registry shared across intake, roadmap, schedule-a, and
-- comparison. Each app keeps its own record (intake_cards, roadmap_tasks,
-- gantt_state entries) with its own free-text title, and will link back to a
-- row here via a project_id column/key added in a follow-up migration. That
-- keeps "is this the same underlying project" independent of what any one
-- app happens to call it, so a rename in one app doesn't break the link.
--
-- Projects can be created from either intake or roadmap (a request can start
-- life in either app), so origin_app is constrained to just those two rather
-- than all four related apps. schedule-a and comparison only ever link to an
-- existing project, they don't mint new ones.

-- origin_app / project_key values below match the strings project_access
-- actually uses (confirmed against the live table), which don't line up
-- 1:1 with the app folder names: 'intake', 'roadmap-db', 'schedule-a-db-v2'.
-- There is no separate 'comparison' key — comparison's own auth-gate just
-- requires viewer/editor on roadmap-db and/or schedule-a-db-v2 directly.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  origin_app text not null check (origin_app in ('intake', 'roadmap-db')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backs the "search existing projects while typing a new title" typeahead
-- that intake/roadmap will use to avoid creating duplicate projects.
create index if not exists projects_canonical_name_idx
  on public.projects (lower(canonical_name));

alter table public.projects enable row level security;

-- Read: anyone signed in with access to one of the four related apps.
-- comparison users always hold roadmap-db and/or schedule-a-db-v2 access
-- (that's what its own auth-gate requires), so listing those two keys
-- covers comparison as well as schedule-a directly.
drop policy if exists "projects select by related app access" on public.projects;
create policy "projects select by related app access"
  on public.projects
  for select
  using (
    exists (
      select 1 from public.project_access
      where user_id = auth.uid()
        and project_key in ('intake', 'roadmap-db', 'schedule-a-db-v2')
    )
  );

-- Insert: only editors of intake or roadmap-db, matching where project
-- creation is actually exposed in the UI.
drop policy if exists "projects insert by intake/roadmap editors" on public.projects;
create policy "projects insert by intake/roadmap editors"
  on public.projects
  for insert
  with check (
    exists (
      select 1 from public.project_access
      where user_id = auth.uid()
        and project_key in ('intake', 'roadmap-db')
        and role = 'editor'
    )
  );

-- Update: editors of any of the three related project_access keys, since
-- renaming a project is expected to happen from comparison (which already
-- syncs renames across roadmap_tasks and gantt_state, gated on roadmap-db
-- and/or schedule-a-db-v2 editor there) as well as from intake or roadmap
-- directly.
drop policy if exists "projects update by related app editors" on public.projects;
create policy "projects update by related app editors"
  on public.projects
  for update
  using (
    exists (
      select 1 from public.project_access
      where user_id = auth.uid()
        and project_key in ('intake', 'roadmap-db', 'schedule-a-db-v2')
        and role = 'editor'
    )
  )
  with check (
    exists (
      select 1 from public.project_access
      where user_id = auth.uid()
        and project_key in ('intake', 'roadmap-db', 'schedule-a-db-v2')
        and role = 'editor'
    )
  );

-- Delete: admin only. Deleting a project can orphan links from multiple
-- apps at once, so this is reserved for a deliberate admin action (e.g. a
-- future "merge duplicate projects" tool), not routine app usage.
drop policy if exists "projects admin delete" on public.projects;
create policy "projects admin delete"
  on public.projects
  for delete
  using (public.is_app_admin());

-- RLS alone doesn't grant table access (learned the hard way on
-- project_access in 20260814090000_project_access_grants.sql) — the role
-- still needs a base GRANT before RLS policies are even consulted.
grant select, insert, update on public.projects to authenticated;
grant select, insert, update, delete, truncate on public.projects to service_role;
