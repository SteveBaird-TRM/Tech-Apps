-- Keeps data and the typed columns in step in both directions (see the
-- header of 20261014100000 for the rules and the later clean-up).

-- data -> columns.  Empty strings become null.
create or replace function public.intake_cards_from_data(r public.intake_cards)
returns public.intake_cards
language plpgsql
immutable
set search_path = public
as $$
declare
  d jsonb := r.data;
begin
  r.status := d->>'status';
  r.project_type := d->>'projectType';
  r.project_title := nullif(d->>'projectTitle', '');
  r.intake_source := nullif(d->>'intake', '');
  r.project_number := nullif(d->>'projectNumber', '');
  r.requestor_name := nullif(d->>'requestorName', '');
  r.department := nullif(d->>'department', '');
  r.date_received := nullif(d->>'dateReceived', '')::date;
  r.date_ipa_sent := nullif(d->>'dateIpaSent', '')::date;
  r.date_business_case_received := nullif(d->>'dateBusinessCaseReceived', '')::date;
  r.date_prioritisation := nullif(d->>'datePrioritisation', '')::date;
  r.promise_date := nullif(d->>'promiseDate', '')::date;
  r.release_date := nullif(d->>'releaseDate', '')::date;
  r.strategic_score := round(nullif(d->>'strategicScore', '')::numeric)::smallint;
  r.operational_score := round(nullif(d->>'operationalScore', '')::numeric)::smallint;
  r.customer_score := round(nullif(d->>'customerScore', '')::numeric)::smallint;
  r.commercial_score := nullif(d->>'commercialScore', '')::numeric;
  r.annual_value := nullif(d->>'annualValue', '')::numeric;
  r.big_thinking := coalesce((d->>'bigThinking')::boolean, false);
  r.big_thinking_notes := nullif(d->>'bigThinkingNotes', '');
  r.defined_business_benefit := coalesce((d->>'definedBusinessBenefit')::boolean, false);
  r.business_benefit := nullif(d->>'businessBenefit', '');
  r.comments := nullif(d->>'comments', '');
  r.position := coalesce(round(nullif(d->>'position', '')::numeric)::bigint, 0);
  r.created_at := coalesce(nullif(d->>'createdAt', '')::timestamptz, r.created_at);
  return r;
end;
$$;

-- columns -> JSON, in the old data shape (empty string for null).
create or replace function public.intake_cards_columns_json(r public.intake_cards)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'status', r.status,
    'projectType', r.project_type,
    'projectTitle', coalesce(r.project_title, ''),
    'intake', coalesce(r.intake_source, ''),
    'projectNumber', coalesce(r.project_number, ''),
    'requestorName', coalesce(r.requestor_name, ''),
    'department', coalesce(r.department, ''),
    'dateReceived', coalesce(r.date_received::text, ''),
    'dateIpaSent', coalesce(r.date_ipa_sent::text, ''),
    'dateBusinessCaseReceived', coalesce(r.date_business_case_received::text, ''),
    'datePrioritisation', coalesce(r.date_prioritisation::text, ''),
    'promiseDate', coalesce(r.promise_date::text, ''),
    'releaseDate', coalesce(r.release_date::text, ''),
    'strategicScore', coalesce(to_jsonb(r.strategic_score), '""'::jsonb),
    'operationalScore', coalesce(to_jsonb(r.operational_score), '""'::jsonb),
    'customerScore', coalesce(to_jsonb(r.customer_score), '""'::jsonb),
    'commercialScore', coalesce(to_jsonb(r.commercial_score), '""'::jsonb),
    'annualValue', coalesce(to_jsonb(r.annual_value), '""'::jsonb),
    'bigThinking', r.big_thinking,
    'bigThinkingNotes', coalesce(r.big_thinking_notes, ''),
    'definedBusinessBenefit', r.defined_business_benefit,
    'businessBenefit', coalesce(r.business_benefit, ''),
    'comments', coalesce(r.comments, ''),
    'position', r.position
  );
$$;

create or replace function public.intake_cards_sync_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.data := coalesce(new.data, '{}'::jsonb);

  if new.status is null then
    new := public.intake_cards_from_data(new);
  elsif tg_op = 'INSERT'
     or public.intake_cards_columns_json(new) is distinct from public.intake_cards_columns_json(old) then
    new.data := new.data || public.intake_cards_columns_json(new) || jsonb_build_object(
      'id', new.id,
      'createdAt', to_char(new.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  elsif new.data is distinct from old.data then
    new := public.intake_cards_from_data(new);
  end if;

  return new;
end;
$$;

create or replace trigger intake_cards_sync_columns
  before insert or update on public.intake_cards
  for each row execute function public.intake_cards_sync_columns();

-- Backfill.  The existing updated_at trigger would stamp every row with
-- now(), so pause it and restore each card's own timestamp afterwards.
alter table public.intake_cards disable trigger set_intake_cards_updated_at;
update public.intake_cards set data = data where status is null;
update public.intake_cards
  set updated_at = (data->>'updatedAt')::timestamptz
  where data->>'updatedAt' ~ '^\d{4}-\d{2}-\d{2}T';
alter table public.intake_cards enable trigger set_intake_cards_updated_at;
