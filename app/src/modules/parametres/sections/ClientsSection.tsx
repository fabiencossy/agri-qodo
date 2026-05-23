/**
 * Section Paramètres → Annuaire clients (res.partner Odoo).
 *
 * Extrait depuis TravauxConfigSection. Liste + CRUD clients tiers utilisés
 * dans le module Travaux + Parcellaire (panneau de droite).
 */
import { useMemo, useState } from 'react';
import { useClients, addClient, updateClient, removeClient } from '../../travaux/travaux.store';
import type { ThirdPartyClient } from '../../travaux/travaux.types';
import { useCan } from '../../users/permissions';
import {
  SectionCard,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  EmptyState,
  Field,
} from './_shared';
import { inputClass } from './_styles';

export function ClientsSection() {
  const canWrite = useCan('parametres', 'admin');
  const clients = useClients();
  const [editing, setEditing] = useState<Partial<ThirdPartyClient> | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const lc = search.toLowerCase().trim();
    return clients
      .filter((c) => (showArchived ? true : c.active))
      .filter((c) =>
        !lc
          ? true
          : c.name.toLowerCase().includes(lc) ||
            (c.city ?? '').toLowerCase().includes(lc) ||
            (c.email ?? '').toLowerCase().includes(lc) ||
            (c.vatNumber ?? '').toLowerCase().includes(lc),
      );
  }, [clients, search, showArchived]);

  const handleDelete = (c: ThirdPartyClient) => {
    if (confirm(`Supprimer le client ${c.name} ?`)) {
      removeClient(c.id);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Annuaire clients — ${filtered.length}`}
        description="Clients tiers facturés via les bons de travail. Mappés vers res.partner Odoo (Phase 3)."
        actions={
          canWrite && (
            <PrimaryButton onClick={() => setEditing({ active: true })}>
              + Nouveau client
            </PrimaryButton>
          )
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, ville, email, IDE)"
            className={`${inputClass} max-w-sm flex-1`}
          />
          <label className="inline-flex items-center gap-2 text-xs text-(--color-muted)">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 accent-(--color-primary)"
            />
            Afficher les archivés
          </label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState>Aucun client ne correspond.</EmptyState>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-[11px] text-(--color-muted)">
                    {c.city ?? '—'}
                    {c.email && ` · ${c.email}`}
                    {c.phone && ` · ${c.phone}`}
                    {c.vatNumber && ` · ${c.vatNumber}`}
                    {!c.active && ' · ARCHIVÉ'}
                  </div>
                </div>
                <SecondaryButton onClick={() => setEditing(c)} disabled={!canWrite}>
                  {canWrite ? 'Modifier' : 'Voir'}
                </SecondaryButton>
                {canWrite && (
                  <DangerButton
                    onClick={() => handleDelete(c)}
                    className="!h-9 !w-9 !justify-center !px-0"
                    aria-label={`Supprimer ${c.name}`}
                  >
                    ×
                  </DangerButton>
                )}
              </li>
            ))}
          </ul>
        )}

        {editing && <ClientEditModal initial={editing} onClose={() => setEditing(null)} />}
      </SectionCard>
    </div>
  );
}

function ClientEditModal({
  initial,
  onClose,
}: {
  initial: Partial<ThirdPartyClient>;
  onClose: () => void;
}) {
  const isExisting = Boolean(initial?.id);
  const [draft, setDraft] = useState<Partial<ThirdPartyClient>>({ active: true, ...initial });

  const setField = <K extends keyof ThirdPartyClient>(k: K, v: ThirdPartyClient[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = () => {
    if (!draft.name?.trim()) return;
    const client: ThirdPartyClient = {
      id: draft.id ?? `C-${Date.now()}`,
      name: draft.name,
      city: draft.city,
      email: draft.email,
      phone: draft.phone,
      notes: draft.notes,
      vatNumber: draft.vatNumber,
      active: draft.active ?? true,
      odooPartnerId: draft.odooPartnerId,
    };
    if (isExisting && draft.id) updateClient(draft.id, client);
    else addClient(client);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) md:max-w-md md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">
            {isExisting ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
            aria-label="Fermer"
          >
            ×
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <Field label="Raison sociale" required>
            <input
              type="text"
              value={draft.name ?? ''}
              onChange={(e) => setField('name', e.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Ville">
              <input
                type="text"
                value={draft.city ?? ''}
                onChange={(e) => setField('city', e.target.value || undefined)}
                className={inputClass}
              />
            </Field>
            <Field label="Numéro IDE / TVA">
              <input
                type="text"
                value={draft.vatNumber ?? ''}
                onChange={(e) => setField('vatNumber', e.target.value || undefined)}
                placeholder="CHE-123.456.789"
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={draft.email ?? ''}
                onChange={(e) => setField('email', e.target.value || undefined)}
                className={inputClass}
              />
            </Field>
            <Field label="Téléphone">
              <input
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => setField('phone', e.target.value || undefined)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value || undefined)}
              rows={3}
              className="w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Statut">
            <select
              value={String(draft.active ?? true)}
              onChange={(e) => setField('active', e.target.value === 'true')}
              className={inputClass}
            >
              <option value="true">Actif</option>
              <option value="false">Archivé</option>
            </select>
          </Field>
        </div>
        <footer className="flex gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) px-4 text-sm hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.name?.trim()}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            {isExisting ? 'Enregistrer' : 'Créer'}
          </button>
        </footer>
      </div>
    </div>
  );
}
