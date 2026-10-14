-- Final step of moving intake_cards onto typed columns.
-- Removes the legacy data blob and the trigger and functions that kept it in
-- step with the columns.  Irreversible: only run once the new intake pages
-- have been live and working for a while.
-- Not carried over: projectDescription (projects owns it) and the old
-- updatedAt string (updated_at replaces it).

-- Safety check.  Stops the migration if any card's columns differ from what
-- its blob would give, which means something still writes the blob only.
do $$
declare
  bad int;
begin
  select count(*) into bad
  from public.intake_cards c
  where public.intake_cards_columns_json(public.intake_cards_from_data(c))
        is distinct from public.intake_cards_columns_json(c);
  if bad > 0 then
    raise exception 'drop_intake_cards_data: % card(s) have columns that differ from data.  Not dropping.', bad;
  end if;
end $$;

drop trigger if exists intake_cards_sync_columns on public.intake_cards;
drop function if exists public.intake_cards_sync_columns();
drop function if exists public.intake_cards_from_data(public.intake_cards);
drop function if exists public.intake_cards_columns_json(public.intake_cards);

alter table public.intake_cards drop column data;
