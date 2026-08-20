-- Replaces the projects.delivered boolean (20260819191441_add_projects_delivered.sql)
-- with a tri-state status column. intake_cards already models terminal states
-- this way (status includes both 'delivered' and 'rejected' as sibling
-- columns, see intake/index.html's COLUMNS array) — mirroring that here means
-- a rejected project can now also be hidden from the intake/roadmap/schedule-a
-- pickers, which a second boolean would have made awkward (a project could
-- never be both delivered and rejected, so two independent booleans would
-- allow an invalid combination a single status can't).
--
-- not null default 'open' so every row always has an explicit state — no
-- NULL-handling needed in picker/admin filters, and new projects created via
-- any of the three apps start 'open' automatically.

alter table public.projects
  add column status text not null default 'open'
  check (status in ('open', 'delivered', 'rejected'));

update public.projects set status = 'delivered' where delivered;

alter table public.projects drop column delivered;
