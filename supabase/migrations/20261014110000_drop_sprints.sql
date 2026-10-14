-- sprints is unused: no app reads it, and its policies need a project_access
-- key ('implementation-forum') that the check constraint does not allow.
-- Dropped on 14 October 2026.  It held 12 rows, Sprint 142 to 176.
drop table if exists public.sprints;
