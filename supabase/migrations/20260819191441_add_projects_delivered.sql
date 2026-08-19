-- Tracks whether a project has been delivered, driven by intake: when a
-- card's status is set to "delivered", the linked project's row is flipped
-- to true (see intake/index.html's updateCardField). Not touched by
-- roadmap/schedule-a directly.

alter table public.projects add column if not exists delivered boolean not null default false;
