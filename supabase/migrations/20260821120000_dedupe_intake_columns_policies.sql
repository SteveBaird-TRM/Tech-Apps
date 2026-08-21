-- intake_columns had two overlapping sets of RLS policies covering the same
-- operations: "intake_columns delete/insert/read/update" (using the shared
-- has_project_access() helper, matching roadmap_tasks/intake_cards/tasks/
-- gantt_state) and "intake_columns_select"/"intake_columns_write" (an
-- inline exists-against-project_access check added separately). Postgres
-- OR's multiple permissive policies for the same command together, so this
-- wasn't a security hole — both sets enforce the same access — just
-- duplicated logic. Drop the inline set and keep the has_project_access()
-- set for consistency with every other table.

drop policy if exists "intake_columns_select" on public.intake_columns;
drop policy if exists "intake_columns_write" on public.intake_columns;
