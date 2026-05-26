-- ========================================================================
-- Migration 0007 — Photos bucket RLS + resserrage des grants
-- ========================================================================
-- Findings audit security-auditor (2026-05-25) :
--
-- F-004 [HAUTE] Bucket `photos` Supabase Storage sans policy RLS ni MIME
--               whitelist : risque de bucket public + injection SVG/XSS.
--               Création explicite du bucket privé avec policies et limites.
--
-- F-005 [HAUTE] `grant all on all tables in schema public to authenticated`
--               (migration 0001 ligne 579) = grant trop large. Si une future
--               migration crée une table sans RLS, elle devient automatique-
--               ment accessible via PostgREST. On revoke + on grant par
--               table explicitement (toutes les tables farm-scope existantes).
-- ========================================================================

-- ─── F-004 : Storage bucket `photos` ──────────────────────────────────────
-- Bucket non-public, taille max 10 MiB, MIME whitelist (WebP servi par la
-- compression client + JPEG/PNG/HEIC en upload original au cas où).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Naming convention de l'app : `{entityType}/{entityId}/{photoId}.{ext}`
-- (cf. photo.store.ts). On utilise storage.foldername()[1] pour le type
-- d'entité et on filtre sur des valeurs whitelistées seulement.

drop policy if exists "photos_read_authenticated" on storage.objects;
create policy "photos_read_authenticated" on storage.objects
  for select using (
    bucket_id = 'photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] in ('parcelle', 'intervention', 'observation', 'workorder', 'marker')
  );

drop policy if exists "photos_insert_authenticated" on storage.objects;
create policy "photos_insert_authenticated" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] in ('parcelle', 'intervention', 'observation', 'workorder', 'marker')
  );

drop policy if exists "photos_update_owner" on storage.objects;
create policy "photos_update_owner" on storage.objects
  for update using (bucket_id = 'photos' and auth.uid()::text = owner)
  with check (bucket_id = 'photos' and auth.uid()::text = owner);

drop policy if exists "photos_delete_owner" on storage.objects;
create policy "photos_delete_owner" on storage.objects
  for delete using (bucket_id = 'photos' and auth.uid()::text = owner);

-- ─── F-005 : Resserrage des grants ────────────────────────────────────────
-- On retire le grant global, puis on redonne table par table. Toute nouvelle
-- table devra explicitement être grantée dans sa migration de création.
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

-- Référentiels publics (lecture seule par anon + authenticated)
grant select on public.cultures to anon, authenticated;

-- Tables farm-scope (RLS appliquée + grants nécessaires pour PostgREST)
grant select, insert, update, delete on public.farms                to authenticated;
grant select, insert, update, delete on public.farm_members         to authenticated;
grant select, insert, update, delete on public.farm_invitations     to authenticated;
grant select, insert, update, delete on public.farm_workers         to authenticated;
grant select, insert, update, delete on public.parcels              to authenticated;
grant select, insert, update, delete on public.assolement_segments  to authenticated;
grant select, insert, update, delete on public.products             to authenticated;
grant select, insert, update, delete on public.interventions        to authenticated;
grant select, insert, update, delete on public.intervention_parcels to authenticated;
grant select, insert, update, delete on public.intervention_products to authenticated;

-- Sequences pour les colonnes serial (au cas où il y en aurait — par défaut
-- on utilise uuid, mais on grant explicitement les sequences existantes).
grant usage, select on all sequences in schema public to authenticated;
