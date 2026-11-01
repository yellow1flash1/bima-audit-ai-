-- Bima Audit AI — initial schema
-- Multi-tenant (hospital_id on every row), RLS everywhere, append-only hash-chained events.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ───────────────────────── enums ─────────────────────────
create type user_role      as enum ('desk', 'family', 'manager', 'rules_admin');
create type app_locale     as enum ('en-IN', 'hi-IN');
create type irdai_list     as enum ('I', 'II', 'III', 'IV', 'NONE');
create type department     as enum ('room', 'nursing', 'icu', 'pharmacy', 'implant', 'device',
                                    'diagnostics', 'ot', 'surgeon', 'consultation', 'procedure',
                                    'consumables', 'treatment', 'misc');
create type audit_flag     as enum ('green', 'amber', 'red');
create type case_status    as enum ('draft', 'auditing', 'submitted', 'authorised', 'disputed', 'closed');

-- ───────────────────────── tenants & users ─────────────────────────
create table hospitals (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  rohini_id            text unique,
  differential_billing boolean not null default true,
  created_at           timestamptz not null default now()
);

create table users (
  id               uuid primary key references auth.users(id) on delete cascade,
  hospital_id      uuid references hospitals(id),          -- null for family users
  role             user_role not null,
  preferred_locale app_locale not null default 'en-IN',
  plain_language   boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ───────────────────────── policies & cases ─────────────────────────
create table policies (
  id                uuid primary key default gen_random_uuid(),
  hospital_id       uuid not null references hospitals(id),
  insurer           text not null,
  tpa               text,
  policy_ref_alias  text not null,                         -- POLICY_REF_01, never the raw number
  sum_insured       numeric(12,2) not null check (sum_insured > 0),
  room_cap_type     text not null check (room_cap_type in ('fixed', 'percent_si', 'none')),
  room_cap_value    numeric(12,2),                         -- ₹/day or % of SI
  icu_cap_type      text check (icu_cap_type in ('fixed', 'percent_si', 'none')),
  icu_cap_value     numeric(12,2),
  consumables_addon boolean not null default false,
  sub_limits        jsonb not null default '{}'::jsonb,    -- { "<department>": max ₹ }
  created_at        timestamptz not null default now()
);

create table cases (
  id                     uuid primary key default gen_random_uuid(),
  hospital_id            uuid not null references hospitals(id),
  policy_id              uuid not null references policies(id),
  family_user_id         uuid references auth.users(id),
  patient_alias          text not null,                    -- PATIENT_ALIAS_89A
  status                 case_status not null default 'draft',
  is_package_billing     boolean not null default false,
  admitted_at            timestamptz not null,
  discharge_requested_at timestamptz,                      -- starts the 3-hour IRDAI clock
  authorised_at          timestamptz,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now()
);
create index cases_hospital_status_idx on cases (hospital_id, status);

create table bill_items (
  id                 uuid primary key default gen_random_uuid(),
  hospital_id        uuid not null references hospitals(id),
  case_id            uuid not null references cases(id) on delete cascade,
  line_no            int not null,
  description        text not null,
  department         department not null,
  quantity           numeric(10,2) not null default 1,
  unit_rate          numeric(12,2),
  amount             numeric(12,2) not null check (amount >= 0),
  tpa_deducted       numeric(12,2) not null default 0,
  ocr_confidence     numeric(4,3),
  -- machine suggestion (never authoritative)
  suggested_list     irdai_list,
  suggested_dept     department,
  -- human decision
  confirmed_list     irdai_list,
  remapped_to        department check (remapped_to in ('room', 'procedure', 'treatment')),
  -- written ONLY by the rules engine service role, mirrored from src/lib/rules-engine/evaluate.ts
  flag               audit_flag,
  matched_rule_id    uuid,
  payable_amount     numeric(12,2),
  evaluated_at       timestamptz,
  unique (case_id, line_no)
);

-- ───────────────────────── rules ─────────────────────────
create table irdai_rules (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null,                     -- e.g. L2.SHOE_COVER, PRORATA.EXEMPT
  version               int not null default 1,
  list                  irdai_list not null,
  item_name             text not null,
  source                text not null,                     -- 'IRDAI Master Circular on Health Insurance'
  circular_ref          text not null,                     -- 'IRDAI/HLT/CIR/MISC/…'
  clause                text not null,                     -- 'Annexure I, List II, item 6'
  effective_from        date not null,
  effective_to          date,
  explanation_en        text not null,
  explanation_hi        text not null,
  rebuttal_template_en  text not null,
  rebuttal_template_hi  text not null,
  updated_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  unique (code, version)
);

create table rule_synonyms (
  id       uuid primary key default gen_random_uuid(),
  rule_id  uuid not null references irdai_rules(id) on delete cascade,
  phrase   text not null,                                  -- normalised lowercase phrase
  unique (rule_id, phrase)
);
create index rule_synonyms_phrase_idx on rule_synonyms (phrase);

-- ───────────────────────── documents (raw uploads) ─────────────────────────
create table documents (
  id           uuid primary key default gen_random_uuid(),
  hospital_id  uuid not null references hospitals(id),
  case_id      uuid not null references cases(id) on delete cascade,
  kind         text not null check (kind in ('bill', 'policy_schedule')),
  storage_path text not null,                              -- {hospital_id}/{case_id}/{uuid}.pdf
  mime         text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  bytes        int not null check (bytes <= 15 * 1024 * 1024),
  created_at   timestamptz not null default now()
);

-- Time-limited family access without an account; only the HMAC digest is stored.
create table case_claim_tokens (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases(id) on delete cascade,
  hospital_id uuid not null references hospitals(id),
  token_hmac  text not null unique,
  expires_at  timestamptz not null,
  claimed_by  uuid references auth.users(id)
);

-- ───────────────────────── tamper-evident audit log ─────────────────────────
create table events (
  id          bigint generated always as identity primary key,
  hospital_id uuid not null references hospitals(id),
  case_id     uuid not null references cases(id),
  actor       uuid not null,
  type        text not null,                               -- 'item.remapped', 'rule.updated', …
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  prev_hash   text,
  hash        text not null
);
create index events_case_idx on events (case_id, id);

create or replace function events_hash_chain() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- serialise writers per case so two inserts cannot share a prev_hash
  perform pg_advisory_xact_lock(hashtext(new.case_id::text));
  new.created_at := date_trunc('milliseconds', coalesce(new.created_at, now()));
  select e.hash into new.prev_hash
    from events e where e.case_id = new.case_id
    order by e.id desc limit 1;
  new.hash := encode(digest(
      coalesce(new.prev_hash, 'GENESIS') || new.case_id::text || new.actor::text ||
      new.type || new.payload::text || new.created_at::text,
    'sha256'), 'hex');
  return new;
end $$;

create trigger events_hash_chain_trg before insert on events
  for each row execute function events_hash_chain();

revoke update, delete, truncate on events from authenticated, anon, service_role;

-- ───────────────────────── RLS ─────────────────────────
create or replace function jwt_hospital() returns text language sql stable as $$
  select auth.jwt() ->> 'hospital_id'
$$;
create or replace function jwt_role() returns text language sql stable as $$
  select auth.jwt() ->> 'app_role'
$$;

alter table hospitals         enable row level security;
alter table users             enable row level security;
alter table policies          enable row level security;
alter table cases             enable row level security;
alter table bill_items        enable row level security;
alter table irdai_rules       enable row level security;
alter table rule_synonyms     enable row level security;
alter table documents         enable row level security;
alter table case_claim_tokens enable row level security;
alter table events            enable row level security;

create policy hospitals_tenant on hospitals for select
  using (id::text = jwt_hospital());

create policy users_self on users for select using (id = auth.uid() or hospital_id::text = jwt_hospital());
create policy users_self_update on users for update using (id = auth.uid())
  with check (id = auth.uid());

create policy policies_tenant on policies for all
  using (hospital_id::text = jwt_hospital()) with check (hospital_id::text = jwt_hospital());

-- staff see their hospital's cases; a family user sees only cases bound to them
create policy cases_staff on cases for all
  using (hospital_id::text = jwt_hospital() and jwt_role() in ('desk', 'manager'))
  with check (hospital_id::text = jwt_hospital());
create policy cases_family on cases for select
  using (family_user_id = auth.uid());

create policy bill_items_staff on bill_items for all
  using (hospital_id::text = jwt_hospital() and jwt_role() in ('desk', 'manager'))
  with check (hospital_id::text = jwt_hospital());
create policy bill_items_family on bill_items for select
  using (exists (select 1 from cases c where c.id = case_id and c.family_user_id = auth.uid()));

-- rules are global reference data: readable by everyone signed in, writable by rules_admin
create policy rules_read on irdai_rules for select using (auth.role() = 'authenticated');
create policy rules_write on irdai_rules for insert with check (jwt_role() = 'rules_admin');
create policy rules_update on irdai_rules for update using (jwt_role() = 'rules_admin');
create policy synonyms_read on rule_synonyms for select using (auth.role() = 'authenticated');
create policy synonyms_write on rule_synonyms for all using (jwt_role() = 'rules_admin')
  with check (jwt_role() = 'rules_admin');

create policy documents_staff on documents for all
  using (hospital_id::text = jwt_hospital()) with check (hospital_id::text = jwt_hospital());
create policy documents_family on documents for select
  using (exists (select 1 from cases c where c.id = case_id and c.family_user_id = auth.uid()));

create policy claim_tokens_staff on case_claim_tokens for all
  using (hospital_id::text = jwt_hospital()) with check (hospital_id::text = jwt_hospital());

create policy events_read on events for select
  using (hospital_id::text = jwt_hospital()
         or exists (select 1 from cases c where c.id = case_id and c.family_user_id = auth.uid()));
create policy events_insert on events for insert
  with check (hospital_id::text = jwt_hospital() and actor = auth.uid());

-- Rule history is kept by versioning (code, version): admins insert a new version
-- and set effective_to on the old one rather than editing text in place.

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('bills', 'bills', false)
  on conflict (id) do nothing;

create policy bills_tenant_read on storage.objects for select
  using (bucket_id = 'bills' and (storage.foldername(name))[1] = jwt_hospital());
create policy bills_tenant_write on storage.objects for insert
  with check (bucket_id = 'bills' and (storage.foldername(name))[1] = jwt_hospital());

-- ───────────────────────── 72-hour raw document purge ─────────────────────────
create or replace function purge_raw_documents() returns void
language plpgsql security definer set search_path = public, storage as $$
begin
  delete from storage.objects o
   using documents d
   where o.bucket_id = 'bills' and o.name = d.storage_path
     and d.created_at < now() - interval '72 hours';
  delete from documents where created_at < now() - interval '72 hours';
end $$;

select cron.schedule('purge-raw-documents', '15 * * * *', $$select purge_raw_documents()$$);

-- "Delete My Case & Files Immediately" — callable by the bound family user or hospital staff.
-- Events stay (append-only, contain no PII); everything else for the case is removed.
create or replace function delete_case_now(p_case uuid) returns void
language plpgsql security definer set search_path = public, storage as $$
begin
  if not exists (select 1 from cases c where c.id = p_case
                 and (c.family_user_id = auth.uid() or c.hospital_id::text = jwt_hospital())) then
    raise exception 'not allowed';
  end if;
  delete from storage.objects o using documents d
   where o.bucket_id = 'bills' and o.name = d.storage_path and d.case_id = p_case;
  delete from documents where case_id = p_case;
  delete from bill_items where case_id = p_case;
  update cases set family_user_id = null, patient_alias = 'DELETED', status = 'closed' where id = p_case;
end $$;
