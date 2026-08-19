-- Links roadmap_tasks and intake_cards to the canonical projects registry
-- (see 20260819155600_create_projects_registry.sql). Nullable and left
-- unbackfilled for now — existing rows won't have a project_id until a
-- one-time reconciliation pass links them; new rows get one going forward
-- once the "find or create project" picker lands in each app's UI.
--
-- schedule-a's gantt_state isn't touched here: it's a single JSON blob (one
-- row, id=1) rather than one row per project, so there's no column to add.
-- Its resource entries will carry a projectId key inside the JSON itself —
-- an application-layer change made when the picker writes to it, not a
-- schema change.

alter table public.roadmap_tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists roadmap_tasks_project_id_idx
  on public.roadmap_tasks (project_id);

alter table public.intake_cards
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists intake_cards_project_id_idx
  on public.intake_cards (project_id);
