-- Restricts write access (and full read access) on project_access to a
-- single admin account, so only that person can change viewer/editor roles.
-- Existing "project_access self read" policy (user_id = auth.uid()) is left
-- in place; this just adds admin-only policies alongside it.

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'steve.baird@royalmint.com';
$$;

alter table public.project_access enable row level security;

drop policy if exists "project_access admin read all" on public.project_access;
create policy "project_access admin read all"
  on public.project_access
  for select
  using (public.is_app_admin());

drop policy if exists "project_access admin insert" on public.project_access;
create policy "project_access admin insert"
  on public.project_access
  for insert
  with check (public.is_app_admin());

drop policy if exists "project_access admin update" on public.project_access;
create policy "project_access admin update"
  on public.project_access
  for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "project_access admin delete" on public.project_access;
create policy "project_access admin delete"
  on public.project_access
  for delete
  using (public.is_app_admin());
