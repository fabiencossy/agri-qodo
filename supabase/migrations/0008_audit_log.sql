-- ========================================================================
-- Migration 0008 — Audit log (audit_events)
-- ========================================================================
-- Trace toutes les mutations critiques (parcelles, interventions, membres,
-- abonnements, paramètres). Requis pour :
--   - Audit cantonal phyto (qui a saisi quelle intervention quand)
--   - Détection d'incident sécurité (qui a modifié les droits d'un user)
--   - Forensics si compromission compte
--
-- Triggers automatiques sur les tables farm-scope. Insertion via fonction
-- SECURITY DEFINER : le front ne peut jamais écrire directement dans la
-- table.
--
-- Retention LPD CH : 90 jours par défaut. À purger via cron côté server
-- (cf. note en bas de migration).
-- ========================================================================

create table if not exists public.audit_events (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),
  -- L'utilisateur qui a déclenché la mutation (null si trigger système / RPC anonyme).
  user_id       uuid references auth.users(id) on delete set null,
  -- Farm concernée (null pour mutations globales : signin, plan_changed).
  farm_id       uuid references public.farms(id) on delete cascade,
  -- Type d'entité touchée ('parcel', 'intervention', 'farm_member', etc.).
  entity_type   text not null,
  -- ID textuel de l'entité (uuid converti en text pour uniformité).
  entity_id     text,
  -- Action : 'insert', 'update', 'delete', 'auth.login', 'plan_changed', ...
  action        text not null,
  -- État avant (NULL pour insert) et après (NULL pour delete) en JSON compact.
  before        jsonb,
  after         jsonb,
  -- Métadonnées (IP, user-agent, request id…) — best effort.
  metadata      jsonb
);

create index if not exists audit_events_farm_idx       on public.audit_events (farm_id, occurred_at desc);
create index if not exists audit_events_user_idx       on public.audit_events (user_id, occurred_at desc);
create index if not exists audit_events_entity_idx     on public.audit_events (entity_type, entity_id);
create index if not exists audit_events_occurred_idx   on public.audit_events (occurred_at desc);

alter table public.audit_events enable row level security;

-- Lecture : tous les membres de la farm peuvent voir l'audit log de leur farm.
-- Les events sans farm_id (auth, plan) sont visibles uniquement par l'auteur.
drop policy if exists "audit_events_read_farm_member" on public.audit_events;
create policy "audit_events_read_farm_member" on public.audit_events
  for select using (
    (farm_id is not null and public.is_farm_member(farm_id))
    or (farm_id is null and user_id = auth.uid())
  );

-- Aucun INSERT/UPDATE/DELETE direct depuis le client. La table est en
-- append-only via trigger SECURITY DEFINER ci-dessous.
-- (pas de policy = tout est refusé)

-- ─── Fonction trigger générique ───────────────────────────────────────────
create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id     uuid;
  v_entity_id   text;
  v_before      jsonb;
  v_after       jsonb;
begin
  -- Récupère farm_id depuis le row (les tables critiques l'ont toutes).
  if tg_op = 'DELETE' then
    v_farm_id   := (old).farm_id;
    v_entity_id := (old).id::text;
    v_before    := to_jsonb(old);
    v_after     := null;
  elsif tg_op = 'UPDATE' then
    v_farm_id   := (new).farm_id;
    v_entity_id := (new).id::text;
    v_before    := to_jsonb(old);
    v_after     := to_jsonb(new);
  else  -- INSERT
    v_farm_id   := (new).farm_id;
    v_entity_id := (new).id::text;
    v_before    := null;
    v_after     := to_jsonb(new);
  end if;

  insert into public.audit_events (
    user_id, farm_id, entity_type, entity_id, action, before, after
  )
  values (
    auth.uid(),
    v_farm_id,
    tg_table_name,
    v_entity_id,
    lower(tg_op),
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Triggers sur les tables farm-scope critiques.
-- (Si on en ajoute plus tard, faire pareil dans la migration de création.)

drop trigger if exists audit_parcels             on public.parcels;
create trigger      audit_parcels
  after insert or update or delete on public.parcels
  for each row execute function public.audit_table_change();

drop trigger if exists audit_assolement_segments on public.assolement_segments;
create trigger      audit_assolement_segments
  after insert or update or delete on public.assolement_segments
  for each row execute function public.audit_table_change();

drop trigger if exists audit_interventions       on public.interventions;
create trigger      audit_interventions
  after insert or update or delete on public.interventions
  for each row execute function public.audit_table_change();

drop trigger if exists audit_farm_members        on public.farm_members;
create trigger      audit_farm_members
  after insert or update or delete on public.farm_members
  for each row execute function public.audit_table_change();

drop trigger if exists audit_farm_invitations    on public.farm_invitations;
create trigger      audit_farm_invitations
  after insert or update or delete on public.farm_invitations
  for each row execute function public.audit_table_change();

-- ─── RPC pour les events « non-row » (auth, plan, sync) ──────────────────
-- Appelée depuis Edge Functions ou triggers GoTrue. Front ne peut pas
-- l'appeler avec un user_id arbitraire (forcé à auth.uid()).
create or replace function public.log_audit_event(
  p_farm_id     uuid,
  p_entity_type text,
  p_entity_id   text,
  p_action      text,
  p_metadata    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (
    user_id, farm_id, entity_type, entity_id, action, metadata
  )
  values (
    auth.uid(), p_farm_id, p_entity_type, p_entity_id, p_action, p_metadata
  );
end;
$$;

-- Grants : lecture via PostgREST + execute RPC.
grant select on public.audit_events to authenticated;
grant execute on function public.log_audit_event(uuid, text, text, text, jsonb) to authenticated;

-- ─── Retention 90 jours (LPD CH) ──────────────────────────────────────────
-- À brancher sur pg_cron côté serveur :
--   select cron.schedule(
--     'purge-audit-events',
--     '0 3 * * *',  -- chaque jour à 3h
--     $$ delete from public.audit_events where occurred_at < now() - interval '90 days' $$
--   );
-- Note : pg_cron n'est pas activé par défaut sur Supabase self-hosted ; le
-- script d'install (infra/supabase/bootstrap.sh) doit le créer si présent.
-- Sinon, planifier une tâche systemd timer côté VPS.
