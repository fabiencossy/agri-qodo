import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  setOdooEntityStatus,
  updateOdooSettings,
  useIntegrations,
  type OdooSettings,
  type SyncEntityStatus,
} from '../integrations.store';
import { useCan } from '../../users/permissions';
import { useUsers } from '../../users/users.store';
import { listUsersMissingOdooTag } from '../../users/odoo-mapping';
import { Field, PrimaryButton, SecondaryButton, SectionCard } from './_shared';
import { inputClass, selectClass } from './_styles';

interface EntityConfig {
  key: keyof OdooSettings['entities'];
  label: string;
  odooModel: string;
  appCounterpart: string;
  description?: string;
}

/** Nombres simulés par entité pour le bouton "Synchroniser" (MVP). */
const SIM_RECORD_COUNTS: Record<string, number> = {
  employees: 12,
  partners: 47,
  products: 286,
  parcels: 27,
  attendance: 1840,
  workOrders: 64,
};

const ENTITIES: ReadonlyArray<EntityConfig> = [
  {
    key: 'employees',
    label: 'Employés',
    odooModel: 'hr.employee',
    appCounterpart: 'Utilisateurs',
    description: 'Référentiel employés (avec ou sans compte utilisateur)',
  },
  {
    key: 'partners',
    label: 'Clients tiers',
    odooModel: 'res.partner',
    appCounterpart: 'Travaux > Clients',
    description: 'Synchronisation bidirectionnelle des fiches client',
  },
  {
    key: 'products',
    label: 'Catalogue produits',
    odooModel: 'product.product',
    appCounterpart: 'Catalogue produits',
    description: 'Phyto, engrais, semences',
  },
  {
    key: 'parcels',
    label: 'Parcelles',
    odooModel: 'agri.parcel',
    appCounterpart: 'Parcellaire',
    description: 'Module custom — Phase 3',
  },
  {
    key: 'attendance',
    label: 'Heures de travail',
    odooModel: 'hr.attendance',
    appCounterpart: 'RH > Mes heures',
    description: 'Helper d’export déjà en place',
  },
  {
    key: 'workOrders',
    label: 'Travaux pour tiers',
    odooModel: 'sale.order + account.move',
    appCounterpart: 'Travaux > Bons',
    description: 'Devis, bons, factures',
  },
];

export function OdooSection() {
  const { odoo } = useIntegrations();
  const canAdmin = useCan('parametres', 'admin');
  const users = useUsers();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const usersMissingTag = useMemo(() => listUsersMissingOdooTag(users), [users]);

  const setField = <K extends keyof OdooSettings>(k: K, v: OdooSettings[K]) =>
    updateOdooSettings({ [k]: v } as Partial<OdooSettings>);

  const testConnection = async () => {
    setTesting(true);
    setTestMessage(null);
    // Simulation MVP — pas d'appel XML-RPC réel
    await new Promise((r) => setTimeout(r, 800));
    setTesting(false);
    if (!odoo.url || !odoo.database || !odoo.login || !odoo.apiKey) {
      setTestMessage({ ok: false, text: 'Veuillez remplir tous les champs avant de tester.' });
      return;
    }
    setTestMessage({
      ok: true,
      text: 'Connexion simulée OK. L’appel XML-RPC réel sera branché en Phase 3.',
    });
  };

  const simulateSync = async (entity: keyof OdooSettings['entities']) => {
    setOdooEntityStatus(entity, { status: 'in-progress' });
    await new Promise((r) => setTimeout(r, 700));
    // Petit compteur simulé par entité (jamais critique — placeholder Phase 3).
    const records = SIM_RECORD_COUNTS[entity];
    setOdooEntityStatus(entity, {
      status: 'success',
      lastSyncAt: new Date().toISOString(),
      recordsCount: records,
      message: `${records} enregistrements synchronisés (simulation)`,
    });
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Connexion XML-RPC"
        description="Sera branché en Phase 3 — les paramètres sont enregistrés localement dès aujourd'hui."
        actions={
          <SecondaryButton onClick={testConnection} disabled={testing || !canAdmin}>
            {testing ? 'Test…' : 'Tester la connexion'}
          </SecondaryButton>
        }
      >
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={odoo.enabled}
              onChange={(e) => setField('enabled', e.target.checked)}
              disabled={!canAdmin}
            />
            Intégration Odoo activée
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="URL du serveur" hint="ex. https://odoo.exploitation.ch">
            <input
              type="url"
              value={odoo.url}
              onChange={(e) => setField('url', e.target.value)}
              placeholder="https://odoo.exploitation.ch"
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
          <Field label="Base de données" hint="ex. darval-prod">
            <input
              type="text"
              value={odoo.database}
              onChange={(e) => setField('database', e.target.value)}
              placeholder="darval-prod"
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
          <Field label="Login utilisateur" hint="Compte technique recommandé">
            <input
              type="text"
              value={odoo.login}
              onChange={(e) => setField('login', e.target.value)}
              placeholder="sync@exploitation.ch"
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
          <Field
            label="Clé API"
            hint="Générée depuis Odoo > Préférences > Sécurité > Nouvelle clé API"
          >
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={odoo.apiKey}
                onChange={(e) => setField('apiKey', e.target.value)}
                placeholder="••••••••••••••••"
                className={`${inputClass} flex-1`}
                disabled={!canAdmin}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((s) => !s)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) hover:bg-[#f8f8f5]"
                aria-label={showApiKey ? 'Masquer' : 'Afficher'}
              >
                {showApiKey ? '🙈' : '👁'}
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={odoo.autoSync}
              onChange={(e) => setField('autoSync', e.target.checked)}
              disabled={!canAdmin}
            />
            Synchronisation automatique
          </label>
          <Field label="Intervalle de synchronisation">
            <select
              value={odoo.syncIntervalMinutes}
              onChange={(e) => setField('syncIntervalMinutes', Number(e.target.value))}
              className={selectClass}
              disabled={!canAdmin || !odoo.autoSync}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 heure</option>
              <option value={240}>4 heures</option>
              <option value={1440}>1 jour</option>
            </select>
          </Field>
        </div>

        {testMessage && (
          <p
            className={[
              'm-0 mt-3 rounded-(--radius-sm) px-3 py-2 text-[12px]',
              testMessage.ok ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]',
            ].join(' ')}
          >
            {testMessage.text}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Mapping & synchronisation par entité"
        description="Modèles Odoo synchronisés avec NewagriQodo. Bouton Synchroniser = simulation MVP."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-left text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                <th className="py-2 pr-2">Entité</th>
                <th className="px-2 py-2">Modèle Odoo</th>
                <th className="px-2 py-2">Statut</th>
                <th className="px-2 py-2">Dernière sync</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ENTITIES.map((e) => {
                const st = odoo.entities[e.key];
                return (
                  <tr key={e.key} className="border-b border-(--color-border) align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{e.label}</div>
                      <div className="text-[11px] text-(--color-muted)">
                        ↔ {e.appCounterpart}
                        {e.description && (
                          <>
                            <br />
                            {e.description}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <code className="rounded-(--radius-sm) bg-[#f1f1ee] px-1.5 py-0.5 text-[11px]">
                        {e.odooModel}
                      </code>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={st} />
                    </td>
                    <td className="px-2 py-2 text-[11px] text-(--color-muted)">
                      {st.lastSyncAt ? (
                        <>
                          {formatDateTime(st.lastSyncAt)}
                          {typeof st.recordsCount === 'number' && (
                            <>
                              <br />
                              {st.recordsCount} enregistrements
                            </>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <PrimaryButton
                        onClick={() => simulateSync(e.key)}
                        disabled={!odoo.enabled || !canAdmin || st.status === 'in-progress'}
                      >
                        {st.status === 'in-progress' ? '…' : 'Synchroniser'}
                      </PrimaryButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="m-0 mt-3 text-[11px] text-(--color-muted)">
          <span className="font-medium">Sécurité :</span> les clés API sont stockées en clair dans
          le localStorage de ce navigateur. Phase 3 : déplacement côté serveur, chiffrement,
          rotation.
        </p>
      </SectionCard>

      <SectionCard
        title="Mapping employés ↔ étiquettes Field Service"
        description="Pour Field Service, chaque employé d'AgriQodo est représenté par une étiquette project.tags dans Odoo. Cette étiquette est ajoutée à task.tag_ids pour signaler l'assignation. Convention indispensable quand les employés n'ont pas de compte res.users."
      >
        {usersMissingTag.length === 0 ? (
          <p className="m-0 rounded-(--radius-sm) bg-[#dcfce7] px-3 py-2 text-sm text-[#166534]">
            Tous les employés actifs ont une étiquette Odoo dédiée. Le mapping Field Service est
            complet.
          </p>
        ) : (
          <div>
            <p className="m-0 mb-2 rounded-(--radius-sm) bg-[#fef3c7] px-3 py-2 text-sm text-[#92400e]">
              {usersMissingTag.length} employé{usersMissingTag.length > 1 ? 's' : ''} actif
              {usersMissingTag.length > 1 ? 's n’ont' : ' n’a'} pas d'étiquette Odoo. À renseigner
              avant la 1re synchronisation Field Service.
            </p>
            <ul className="m-0 list-none space-y-1 p-0">
              {usersMissingTag.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
                >
                  <span
                    aria-hidden
                    className="inline-block h-6 w-6 shrink-0 rounded-(--radius-pill) text-center text-[10px] font-semibold leading-6 text-white"
                    style={{ background: u.color }}
                  >
                    {u.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{u.fullName}</span>
                  <Link
                    to={`/parametres/utilisateurs/${u.id}`}
                    className="text-xs text-(--color-primary) underline"
                  >
                    Définir l'étiquette
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatusBadge({ status }: { status: SyncEntityStatus }) {
  const map: Record<SyncEntityStatus['status'], { bg: string; text: string; label: string }> = {
    never: { bg: 'bg-[#f1f1ee]', text: 'text-(--color-text)', label: 'Jamais sync.' },
    success: { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', label: 'OK' },
    error: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'Erreur' },
    'in-progress': { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', label: 'En cours…' },
  };
  const s = map[status.status];
  return (
    <span
      className={[
        'inline-flex items-center rounded-(--radius-pill) px-2 py-0.5 text-[10px] font-medium',
        s.bg,
        s.text,
      ].join(' ')}
    >
      {s.label}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}
