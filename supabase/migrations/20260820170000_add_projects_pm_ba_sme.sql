-- Adds PM/BA/SME as project-level fields on the shared projects registry
-- (not roadmap_tasks) since they identify who's assigned to run the
-- project, not roadmap's tracking state — same reasoning as canonical_name
-- living here rather than being duplicated per-app. Free text since a
-- project can have more than one name in a role ("Jane Doe, John Smith").

alter table public.projects
  add column if not exists pm text,
  add column if not exists ba text,
  add column if not exists sme text;
