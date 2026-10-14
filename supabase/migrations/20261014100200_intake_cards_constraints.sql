-- Rules.  If any existing row breaks one, the whole migration fails.
alter table public.intake_cards
  alter column status set not null,
  alter column project_type set not null;

alter table public.intake_cards
  add constraint intake_cards_status_fkey
    foreign key (status) references public.intake_columns (id) on update cascade,
  add constraint intake_cards_project_type_check
    check (project_type in ('Epic', 'Feature', 'Change', 'Bug', 'Technology')),
  add constraint intake_cards_intake_source_check
    check (intake_source is null
      or intake_source in ('TechHub', 'Meeting', 'Technology', 'Bug', 'Out of Process')),
  add constraint intake_cards_scores_check
    check (coalesce(strategic_score, 0) between 0 and 100
       and coalesce(operational_score, 0) between 0 and 100
       and coalesce(customer_score, 0) between 0 and 100
       and coalesce(commercial_score, 0) >= 0
       and coalesce(annual_value, 0) >= 0);

create index if not exists intake_cards_status_idx on public.intake_cards (status);
