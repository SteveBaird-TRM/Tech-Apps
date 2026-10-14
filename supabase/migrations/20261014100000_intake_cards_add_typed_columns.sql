-- Moves intake_cards off the JSON blob and onto real columns.
--
-- Bridge: a trigger keeps data and the columns in step in both directions,
-- so the old app (writes data) and the new app (writes columns) both work
-- during rollout.  Rules, in order:
--   1. Columns not filled yet (status is null): fill them from data.
--   2. Insert with columns given: columns win, data is rebuilt from them.
--   3. Update that changed data only: fill the columns from data.
--   4. Update that changed any column: columns win, data is rebuilt.
-- Clean-up once nothing reads or writes data (a later migration):
--   drop trigger intake_cards_sync_columns on public.intake_cards;
--   drop function public.intake_cards_sync_columns();
--   drop function public.intake_cards_from_data(public.intake_cards);
--   drop function public.intake_cards_columns_json(public.intake_cards);
--   alter table public.intake_cards drop column data;
-- projectDescription is not copied.  projects owns it.

alter table public.intake_cards
  add column if not exists status text,
  add column if not exists project_type text,
  add column if not exists project_title text,
  add column if not exists intake_source text,
  add column if not exists project_number text,
  add column if not exists requestor_name text,
  add column if not exists department text,
  add column if not exists date_received date,
  add column if not exists date_ipa_sent date,
  add column if not exists date_business_case_received date,
  add column if not exists date_prioritisation date,
  add column if not exists promise_date date,
  add column if not exists release_date date,
  add column if not exists strategic_score smallint,
  add column if not exists operational_score smallint,
  add column if not exists customer_score smallint,
  add column if not exists commercial_score numeric(6,2),
  add column if not exists annual_value numeric(12,2),
  add column if not exists big_thinking boolean not null default false,
  add column if not exists big_thinking_notes text,
  add column if not exists defined_business_benefit boolean not null default false,
  add column if not exists business_benefit text,
  add column if not exists comments text,
  add column if not exists position bigint not null default 0,
  add column if not exists created_at timestamptz not null default now();

