-- Pins set_updated_at()'s search_path and attaches it to the tables that have
-- an updated_at column but no trigger.  intake_cards already has one.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create or replace trigger resource_allocations_set_updated_at
  before update on public.resource_allocations
  for each row execute function public.set_updated_at();

create or replace trigger schedule_settings_set_updated_at
  before update on public.schedule_settings
  for each row execute function public.set_updated_at();

create or replace trigger gantt_state_set_updated_at
  before update on public.gantt_state
  for each row execute function public.set_updated_at();
