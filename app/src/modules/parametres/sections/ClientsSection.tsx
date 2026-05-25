/**
 * Section Paramètres → Clients (res.partner Odoo).
 *
 * Pattern aligné sur ProduitsSection : DataTable + SearchBar + bouton inline.
 * Bandeau "Synchronisation Odoo" séparé en tête. Lignes erreur via toast
 * global (notify), pas inline.
 */
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useClients, addClient, updateClient, removeClient } from '../../travaux/travaux.store';
import type { ThirdPartyClient } from '../../travaux/travaux.types';
import { useCan } from '../../users/permissions';
import { SectionCard, PrimaryButton, SecondaryButton, Field } from './_shared';
import { inputClass } from './_styles';
import { useIntegrations } from '../integrations.store';
import {
  pullFromOdoo,
  pushToOdoo,
  syncBidirectional,
  type SyncResult,
  type SyncFailure,
} from '../clients-odoo-sync';
import { notify } from '../../../layouts/notice.store';
import { DataTable, type Column } from '../../../components/DataTable';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../../components/SearchBar';
import type { ParametresOutletContext } from '../ParametresLayout';

export function ClientsSection() {
  const { mobileSelector } = useOutletContext<ParametresOutletContext>();
  const canWrite = useCan('parametres', 'admin');
  const clients = useClients();
  const { odoo } = useIntegrations();
  const [editing, setEditing] = useState<Partial<ThirdPartyClient> | null>(null);
  const [searchState, setSearchState] = useState<SearchState>({ facets: [], groupBy: [] });
  const [syncing, setSyncing] = useState<null | 'pull' | 'push' | 'sync'>(null);
  const [lastSync, setLastSync] = useState<{ at: string; result: SyncResult } | null>(() => {
    try {
      const raw = localStorage.getItem('agriqodo.clients-sync.last');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const odooReady = Boolean(odoo.enabled && odoo.url && odoo.database && odoo.login && odoo.apiKey);

  const runSync = async (mode: 'pull' | 'push' | 'sync') => {
    if (!odooReady) {
      notify("Configurez d'abord Odoo dans Paramètres → Intégration Odoo.", 'error');
      return;
    }
    setSyncing(mode);
    const conn = {
      url: odoo.url,
      database: odoo.database,
      login: odoo.login,
      apiKey: odoo.apiKey,
    };
    let result: SyncResult | SyncFailure;
    if (mode === 'pull') result = await pullFromOdoo(conn);
    else if (mode === 'push') result = await pushToOdoo(conn);
    else result = await syncBidirectional(conn);
    setSyncing(null);
    if (result.ok) {
      const at = new Date().toISOString();
      const stored = { at, result };
      try {
        localStorage.setItem('agriqodo.clients-sync.last', JSON.stringify(stored));
      } catch {
        /* ignore quota */
      }
      setLastSync(stored);
      notify(
        `Sync OK — ${result.pulled} importé(s), ${result.pushed} envoyé(s), ${result.updated} mis à jour${
          result.errors.length ? ` · ${result.errors.length} erreur(s)` : ''
        }`,
        result.errors.length ? 'info' : 'success',
      );
    } else {
      // Message court pour le toast (premier ~200 caractères, le reste est tronqué
      // par NoticeHost qui propose "Voir détails").
      notify(`Sync échouée (${result.stage}) — ${result.message}`, 'error');
    }
  };

  // ─── Filtres SearchBar ──────────────────────────────────────────────
  const fields: FieldDescriptor[] = useMemo(
    () => [
      { id: 'city', label: 'Ville', type: 'text' },
      { id: 'vat', label: 'IDE/TVA', type: 'text' },
      {
        id: 'status',
        label: 'Statut',
        type: 'select',
        options: [
          { label: 'Actif', value: 'active' },
          { label: 'Archivé', value: 'archived' },
        ],
        groupable: true,
      },
      {
        id: 'odoo',
        label: 'Sync Odoo',
        type: 'select',
        options: [
          { label: 'Synchronisé', value: 'yes' },
          { label: 'Non synchronisé', value: 'no' },
        ],
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = (searchState.query ?? '').toLowerCase().trim();
    return clients.filter((c) => {
      if (q) {
        const hay =
          `${c.name} ${c.city ?? ''} ${c.email ?? ''} ${c.phone ?? ''} ${c.vatNumber ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const facet of searchState.facets) {
        if (facet.values.length === 0) continue;
        if (facet.fieldId === 'city') {
          if (
            !facet.values.some((v) =>
              (c.city ?? '').toLowerCase().includes(String(v).toLowerCase()),
            )
          )
            return false;
        } else if (facet.fieldId === 'vat') {
          if (
            !facet.values.some((v) =>
              (c.vatNumber ?? '').toLowerCase().includes(String(v).toLowerCase()),
            )
          )
            return false;
        } else if (facet.fieldId === 'status') {
          const status = c.active ? 'active' : 'archived';
          if (!facet.values.includes(status)) return false;
        } else if (facet.fieldId === 'odoo') {
          const synced = typeof c.odooPartnerId === 'number';
          if (!facet.values.includes(synced ? 'yes' : 'no')) return false;
        }
      }
      return true;
    });
  }, [clients, searchState]);

  const handleDelete = (c: ThirdPartyClient) => {
    if (confirm(`Supprimer le client ${c.name} ?`)) {
      removeClient(c.id);
    }
  };

  const activeCount = clients.filter((c) => c.active).length;
  const syncedCount = clients.filter((c) => typeof c.odooPartnerId === 'number').length;

  const newClientButton = canWrite ? (
    <button
      type="button"
      onClick={() => setEditing({ active: true })}
      aria-label="Nouveau client"
      title="Nouveau client"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-3 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
    >
      <span aria-hidden>+</span>
      <span className="hidden md:inline">Nouveau client</span>
    </button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau sync Odoo bidirectionnel — affiché en tête, séparé de la liste. */}
      <SectionCard
        title="Synchronisation Odoo"
        description={
          odooReady
            ? 'Sync bidirectionnel res.partner ↔ Clients AgriQodo.'
            : "Configurez d'abord Paramètres → Intégration Odoo pour activer la synchronisation."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={() => runSync('sync')} disabled={!odooReady || syncing !== null}>
            {syncing === 'sync' ? 'Synchro…' : '↔ Synchroniser'}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => runSync('pull')}
            disabled={!odooReady || syncing !== null}
          >
            {syncing === 'pull' ? 'Pull…' : '↓ Importer depuis Odoo'}
          </SecondaryButton>
          <SecondaryButton
            onClick={() => runSync('push')}
            disabled={!odooReady || syncing !== null || !canWrite}
          >
            {syncing === 'push' ? 'Push…' : '↑ Envoyer vers Odoo'}
          </SecondaryButton>
          {lastSync && (
            <span className="ml-auto text-[11px] text-(--color-muted)">
              Dernière sync :{' '}
              {new Date(lastSync.at).toLocaleString('fr-CH', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              {' · '}
              {lastSync.result.pulled} importés, {lastSync.result.pushed} envoyés
            </span>
          )}
        </div>
      </SectionCard>

      {/* Liste clients — DataTable style ProduitsSection */}
      <div className="flex flex-col">
        {/* Toolbar desktop */}
        <div className="sticky top-0 z-10 hidden items-center gap-3 border-b border-(--color-border) bg-(--color-bg) py-2 md:flex">
          <div className="shrink-0">
            <h2 className="m-0 text-sm font-semibold">Clients</h2>
            <span className="text-[11px] text-(--color-muted)">
              {activeCount} actifs · {syncedCount} synchronisés Odoo · {clients.length} total
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <SearchBar
              fields={fields}
              value={searchState}
              onChange={setSearchState}
              ariaLabel="Rechercher dans les clients"
            />
          </div>
          {newClientButton}
        </div>

        {/* Toolbar mobile */}
        <div className="sticky top-0 z-10 flex flex-col gap-1 border-b border-(--color-border) bg-(--color-bg) pt-1 pb-1.5 md:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchBar
                fields={fields}
                value={searchState}
                onChange={setSearchState}
                ariaLabel="Rechercher dans les clients"
              />
            </div>
            {newClientButton}
            {mobileSelector}
          </div>
          <span className="px-1 text-[10px] text-(--color-muted)">
            {activeCount} actifs · {syncedCount} synchronisés
          </span>
        </div>

        <div className="pt-1.5">
          <DataTable<ThirdPartyClient>
            rows={filtered}
            getId={(c) => c.id}
            emptyMessage="Aucun client pour ce filtre."
            entityLabel="client"
            columns={clientColumns({ canWrite, setEditing, handleDelete })}
            onRowClick={(c) => setEditing(c)}
            renderMobileCard={(c, { checkbox }) => (
              <>
                <div className="shrink-0 pt-0.5">{checkbox}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                    {typeof c.odooPartnerId === 'number' && (
                      <span
                        title={`Odoo res.partner #${c.odooPartnerId}`}
                        className="rounded-(--radius-pill) bg-(--color-primary)/12 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-primary) uppercase"
                      >
                        Odoo
                      </span>
                    )}
                    {!c.active && (
                      <span className="rounded-(--radius-pill) bg-[#e5e5e5] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-muted) uppercase">
                        Archivé
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-(--color-muted)">
                    {c.city ?? '—'}
                    {c.email && ` · ${c.email}`}
                    {c.phone && ` · ${c.phone}`}
                  </div>
                  {c.vatNumber && (
                    <div className="mt-0.5 font-mono text-[11px] text-(--color-muted)">
                      {c.vatNumber}
                    </div>
                  )}
                </div>
              </>
            )}
          />
        </div>
      </div>

      {editing && <ClientEditModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Définition des colonnes de la table Clients. */
function clientColumns(opts: {
  canWrite: boolean;
  setEditing: (c: Partial<ThirdPartyClient>) => void;
  handleDelete: (c: ThirdPartyClient) => void;
}): Column<ThirdPartyClient>[] {
  const { canWrite, setEditing, handleDelete } = opts;
  return [
    {
      key: 'name',
      label: 'Nom',
      render: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{c.name}</span>
            {typeof c.odooPartnerId === 'number' && (
              <span
                title={`Odoo res.partner #${c.odooPartnerId}`}
                className="shrink-0 rounded-(--radius-pill) bg-(--color-primary)/12 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-primary) uppercase"
              >
                Odoo
              </span>
            )}
          </div>
          {c.email && <div className="truncate text-[11px] text-(--color-muted)">{c.email}</div>}
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Ville',
      render: (c) => (c.city ? c.city : <span className="text-(--color-muted)">—</span>),
    },
    {
      key: 'phone',
      label: 'Téléphone',
      render: (c) =>
        c.phone ? (
          <span className="font-mono text-xs">{c.phone}</span>
        ) : (
          <span className="text-(--color-muted)">—</span>
        ),
    },
    {
      key: 'vat',
      label: 'IDE / TVA',
      render: (c) =>
        c.vatNumber ? (
          <span className="font-mono text-xs">{c.vatNumber}</span>
        ) : (
          <span className="text-(--color-muted)">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (c) =>
        c.active ? (
          <span className="rounded-(--radius-pill) bg-(--color-success)/12 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#166534] uppercase">
            Actif
          </span>
        ) : (
          <span className="rounded-(--radius-pill) bg-[#e5e5e5] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
            Archivé
          </span>
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setEditing(c)}
            disabled={!canWrite}
            className="rounded-(--radius) border border-(--color-border) bg-white px-2 py-1 text-xs font-medium hover:bg-[#fbfbf9] disabled:opacity-50"
          >
            Modifier
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => handleDelete(c)}
              aria-label={`Supprimer ${c.name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius) text-(--color-error) hover:bg-[#fef2f2]"
            >
              <svg
                viewBox="0 0 24 24"
                width={14}
                height={14}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];
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
          {typeof draft.odooPartnerId === 'number' && (
            <span
              title={`Odoo res.partner #${draft.odooPartnerId}`}
              className="rounded-(--radius-pill) bg-(--color-primary)/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-(--color-primary) uppercase"
            >
              Odoo #{draft.odooPartnerId}
            </span>
          )}
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
