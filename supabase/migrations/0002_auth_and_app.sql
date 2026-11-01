-- Wiring for the Next.js app: JWT claims, case fields the engine needs, column-level
-- write limits, family claim tokens, chain read-out and family uploads.

-- ───────────────────────── case fields used by the rules engine ─────────────────────────
alter table cases
  add column case_ref         text,
  add column room_rent_per_day numeric(12,2) not null default 0,
  add column room_days        int not null default 1,
  -- null = inherit hospitals.differential_billing; false for treatments billed at a uniform tariff
  add column differential_billing boolean;
create unique index cases_ref_idx on cases (hospital_id, case_ref);

-- ───────────────────────── JWT custom claims ─────────────────────────
-- Adds hospital_id and app_role to every access token so RLS can read them via auth.jwt().
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable as $$
declare
  claims jsonb := event -> 'claims';
  u record;
begin
  select hospital_id, role into u from public.users where id = (event ->> 'user_id')::uuid;
  if found then
    claims := claims || jsonb_build_object('app_role', u.role::text);
    if u.hospital_id is not null then
      claims := claims || jsonb_build_object('hospital_id', u.hospital_id::text);
    end if;
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on public.users to supabase_auth_admin;
create policy users_auth_admin on public.users as permissive for select to supabase_auth_admin using (true);

-- Anyone who signs up on their own is a family user. Staff rows are provisioned by an admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, role) values (new.id, 'family') on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- users may change their own locale / plain-language preference, never their role or hospital
revoke update on users from authenticated;
grant update (preferred_locale, plain_language) on users to authenticated;

-- ───────────────────────── flags & rupees are engine-only ─────────────────────────
-- Staff may record human decisions; only the service role (the evaluate route running
-- src/lib/rules-engine/evaluate.ts) may write flag / payable_amount.
revoke insert, update on bill_items from authenticated;
grant insert (hospital_id, case_id, line_no, description, department, quantity, unit_rate, amount,
              tpa_deducted, ocr_confidence, suggested_list, suggested_dept)
  on bill_items to authenticated;
grant update (confirmed_list, remapped_to, suggested_list) on bill_items to authenticated;

-- ───────────────────────── deterministic hash input ─────────────────────────
-- created_at::text depends on the session TimeZone; pin it to UTC so the browser can
-- recompute exactly the same string.
create or replace function public.event_ts(ts timestamptz) returns text
language sql immutable as $$
  select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create or replace function events_hash_chain() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.case_id::text));
  new.created_at := date_trunc('milliseconds', coalesce(new.created_at, now()));
  select e.hash into new.prev_hash
    from events e where e.case_id = new.case_id
    order by e.id desc limit 1;
  new.hash := encode(digest(
      coalesce(new.prev_hash, 'GENESIS') || new.case_id::text || new.actor::text ||
      new.type || new.payload::text || public.event_ts(new.created_at),
    'sha256'), 'hex');
  return new;
end $$;

-- Exact strings the trigger hashed, for client-side verification. Runs as the caller (RLS applies).
create or replace function public.case_events(p_case uuid)
returns table (id bigint, case_id uuid, actor uuid, type text, payload_text text, created_at_text text, prev_hash text, hash text)
language sql stable security invoker as $$
  select e.id, e.case_id, e.actor, e.type, e.payload::text, public.event_ts(e.created_at), e.prev_hash, e.hash
    from events e where e.case_id = p_case order by e.id
$$;

-- delete_case_now leaves events in place; record who triggered it
create or replace function delete_case_now(p_case uuid) returns void
language plpgsql security definer set search_path = public, storage as $$
declare
  h uuid;
begin
  select c.hospital_id into h from cases c
   where c.id = p_case and (c.family_user_id = auth.uid() or c.hospital_id::text = jwt_hospital());
  if not found then raise exception 'not allowed'; end if;
  insert into events (hospital_id, case_id, actor, type, payload) values (h, p_case, auth.uid(), 'case.deleted', '{}');
  delete from storage.objects o using documents d
   where o.bucket_id = 'bills' and o.name = d.storage_path and d.case_id = p_case;
  delete from documents where case_id = p_case;
  delete from bill_items where case_id = p_case;
  update cases set family_user_id = null, patient_alias = 'DELETED', status = 'closed' where id = p_case;
end $$;

-- ───────────────────────── family claim tokens (HMAC) ─────────────────────────
create table app_secrets (name text primary key, value text not null);
alter table app_secrets enable row level security;            -- no policies: unreadable via the API
revoke all on app_secrets from anon, authenticated;
insert into app_secrets (name, value)
  values ('claim_hmac_key', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict do nothing;

create or replace function public.claim_hmac(token text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select encode(hmac(token, (select value from app_secrets where name = 'claim_hmac_key'), 'sha256'), 'hex')
$$;
revoke execute on function public.claim_hmac from public, anon, authenticated;

-- Desk staff issue a 24-hour token for a case; only its HMAC is stored.
create or replace function public.issue_claim_token(p_case uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  h uuid;
  tok text := encode(gen_random_bytes(18), 'base64');
begin
  if jwt_role() not in ('desk', 'manager') then raise exception 'not allowed'; end if;
  select hospital_id into h from cases where id = p_case and hospital_id::text = jwt_hospital();
  if not found then raise exception 'not allowed'; end if;
  tok := translate(tok, '+/=', '-_');
  insert into case_claim_tokens (case_id, hospital_id, token_hmac, expires_at)
    values (p_case, h, claim_hmac(tok), now() + interval '24 hours');
  insert into events (hospital_id, case_id, actor, type, payload)
    values (h, p_case, auth.uid(), 'case.claim_issued', '{}');
  return tok;
end $$;

-- A signed-in family user redeems the token once and is bound to the case.
create or replace function public.claim_case(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t case_claim_tokens%rowtype;
begin
  select * into t from case_claim_tokens
   where token_hmac = claim_hmac(p_token) and expires_at > now() and claimed_by is null
   for update;
  if not found then raise exception 'invalid or expired token'; end if;
  update case_claim_tokens set claimed_by = auth.uid() where id = t.id;
  update cases set family_user_id = auth.uid() where id = t.case_id;
  return t.case_id;
end $$;

-- ───────────────────────── family uploads ─────────────────────────
create policy documents_family_insert on documents for insert
  with check (exists (select 1 from cases c where c.id = case_id and c.family_user_id = auth.uid()
                      and c.hospital_id = documents.hospital_id));

create policy bills_family_read on storage.objects for select
  using (bucket_id = 'bills' and exists (
    select 1 from cases c where c.id::text = (storage.foldername(name))[2] and c.family_user_id = auth.uid()));
create policy bills_family_write on storage.objects for insert
  with check (bucket_id = 'bills' and exists (
    select 1 from cases c where c.id::text = (storage.foldername(name))[2]
      and c.hospital_id::text = (storage.foldername(name))[1] and c.family_user_id = auth.uid()));

update storage.buckets
   set file_size_limit = 15 * 1024 * 1024,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
 where id = 'bills';

-- ───────────────────────── family read access to case context ─────────────────────────
create policy hospitals_family on hospitals for select
  using (exists (select 1 from cases c where c.hospital_id = hospitals.id and c.family_user_id = auth.uid()));
create policy policies_family on policies for select
  using (exists (select 1 from cases c where c.policy_id = policies.id and c.family_user_id = auth.uid()));
