import { useMemo, useState } from 'react';
import { addFarmLocal, useFarms } from './farms.store';
import {
  deriveColor,
  deriveInitials,
  evaluateNewFarmPricing,
  filterOwnedFarms,
} from './farms.helpers';
import { useCurrentUser } from '../users/permissions';
import { usePreferences, updatePreferences } from '../parametres/preferences.store';
import { useClients } from '../travaux/travaux.store';
import type { Farm } from './farms.types';

type OwnershipMode = 'personal' | 'managed';

interface NewFarmModalProps {
  onClose: () => void;
}

/**
 * Modal de création d'une nouvelle exploitation possédée par l'utilisateur
 * courant. Jamais bloquant — la facturation est jamais un mur, juste un
 * avertissement quand le plan va passer de Solo à Multi.
 *
 * Facturation : Odoo personnel via Master Qodo (pas de Stripe direct). Le
 * passage Solo → Multi sera synchronisé à Odoo en Phase 3 ; ici on bascule
 * juste le plan en local après confirmation utilisateur.
 *
 * Pour le MVP local, la nouvelle exploitation est ajoutée au store en
 * mémoire (mocks) — Phase 3 : POST vers Supabase via createFarm().
 */
export function NewFarmModal({ onClose }: NewFarmModalProps) {
  const farms = useFarms();
  const currentUser = useCurrentUser();
  const prefs = usePreferences();
  const allClients = useClients();
  const activeClients = useMemo(() => allClients.filter((c) => c.active), [allClients]);
  const ownedFarms = filterOwnedFarms(farms, currentUser?.id);
  const pricingState = evaluateNewFarmPricing(prefs.subscriptionPlan, ownedFarms.length);

  const [seed] = useState(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  );

  const [ownership, setOwnership] = useState<OwnershipMode>('personal');
  const [linkedClientId, setLinkedClientId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [cantonalNumber, setCantonalNumber] = useState('');
  const [notes, setNotes] = useState('');

  const isManaged = ownership === 'managed';
  // En mode 'managed', on doit aussi choisir un client à lier
  const isValid =
    name.trim().length > 0 && Boolean(currentUser) && (!isManaged || Boolean(linkedClientId));

  const submit = () => {
    if (!isValid || !currentUser) return;
    const usedColors = farms.map((f) => f.color);
    const linkedClient = isManaged ? activeClients.find((c) => c.id === linkedClientId) : undefined;
    const newFarm: Farm = {
      id: `F-${seed}`,
      name: name.trim(),
      location: location.trim() || linkedClient?.city,
      cantonalNumber: cantonalNumber.trim() || undefined,
      // Surface totale = somme des surfaces des parcelles, calculée à
      // l'affichage. Pas saisie ici (on n'a pas encore créé les parcelles).
      notes: notes.trim() || undefined,
      initials: deriveInitials(name.trim()),
      color: deriveColor(name.trim(), usedColors),
      ownerUserId: isManaged ? `EXTERNAL-${linkedClientId}` : currentUser.id,
      managedByCurrentUser: isManaged || undefined,
      linkedClientId: isManaged ? linkedClientId : undefined,
    };
    // Une exploitation 'managed' (client externe) ne compte pas dans le forfait
    // perso → pas d'upsell à déclencher.
    if (!isManaged && pricingState === 'upgrade-warning') {
      updatePreferences({ subscriptionPlan: 'multi' });
    }
    addFarmLocal(newFarm);
    onClose();
  };

  const fieldClass =
    'h-10 w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15';

  const ctaLabel = isManaged
    ? "Créer l'exploitation du client"
    : pricingState === 'upgrade-warning'
      ? 'Confirmer et passer au forfait Multi'
      : "Créer l'exploitation";

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouvelle exploitation"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-(--radius-lg) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-popup) md:max-w-md md:rounded-(--radius-lg)"
      >
        <header className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Nouvelle exploitation</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-(--color-muted) hover:bg-[#f1f1ee]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {/* Choix du mode d'ownership : perso (forfait) vs client externe (hors-forfait) */}
          <div>
            <label className="mb-1 block text-xs font-medium">Cette exploitation est…</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOwnership('personal')}
                aria-pressed={ownership === 'personal'}
                className={[
                  'flex flex-col items-start gap-0.5 rounded-(--radius) border px-3 py-2 text-left text-sm transition-colors',
                  ownership === 'personal'
                    ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                    : 'border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-[#f8f8f5]',
                ].join(' ')}
              >
                <span className="font-medium">La mienne</span>
                <span className="text-[10px] text-(--color-muted)">Comptée dans votre forfait</span>
              </button>
              <button
                type="button"
                onClick={() => setOwnership('managed')}
                aria-pressed={ownership === 'managed'}
                className={[
                  'flex flex-col items-start gap-0.5 rounded-(--radius) border px-3 py-2 text-left text-sm transition-colors',
                  ownership === 'managed'
                    ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                    : 'border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-[#f8f8f5]',
                ].join(' ')}
              >
                <span className="font-medium">Celle d'un client</span>
                <span className="text-[10px] text-(--color-muted)">
                  Gérée pour lui · hors forfait
                </span>
              </button>
            </div>
          </div>

          {/* Encadré pricing — seulement en mode personnel */}
          {!isManaged && pricingState === 'upgrade-warning' && (
            <div className="rounded-(--radius) border border-(--color-warning)/40 bg-(--color-warning)/10 p-3">
              <h3 className="m-0 mb-1 text-sm font-semibold text-[#92400e]">
                Votre forfait va passer à Multi-exploitation
              </h3>
              <p className="m-0 text-[12px] text-[#92400e]">
                Vous êtes actuellement sur le forfait Solo (1 exploitation). En créant cette
                exploitation, votre forfait passera à Multi et votre tarif sera ajusté à la
                prochaine facture (gérée par Odoo).
              </p>
            </div>
          )}

          {!isManaged && pricingState === 'within-multi' && ownedFarms.length > 0 && (
            <div className="rounded-(--radius-sm) bg-[#f1f1ee] px-3 py-2 text-[11px] text-(--color-muted)">
              Forfait Multi · exploitation {ownedFarms.length + 1} — incluse dans votre forfait.
            </div>
          )}

          {!isManaged && pricingState === 'first' && (
            <div className="rounded-(--radius-sm) bg-[#f1f1ee] px-3 py-2 text-[11px] text-(--color-muted)">
              Forfait Solo · 1ʳᵉ exploitation — couverte par le tarif de base.
            </div>
          )}

          {isManaged && (
            <div className="rounded-(--radius-sm) bg-(--color-primary)/8 px-3 py-2 text-[11px] text-(--color-primary)">
              Hors forfait — vous gérez cette exploitation pour le compte du client. Vos droits sont
              les mêmes que sur les vôtres : ajouter parcelles, saisir assolement, carnet…
            </div>
          )}

          {/* Sélecteur Client (uniquement en mode managed) */}
          {isManaged && (
            <div>
              <label htmlFor="nf-client" className="mb-1 block text-xs font-medium">
                Client lié <span className="text-(--color-error)">*</span>{' '}
                <span className="text-[10px] font-normal text-(--color-muted)">
                  (référencé dans Odoo via Travaux pour tiers)
                </span>
              </label>
              <select
                id="nf-client"
                value={linkedClientId}
                onChange={(e) => setLinkedClientId(e.target.value)}
                className={fieldClass}
              >
                <option value="">— Choisir un client —</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` · ${c.city}` : ''}
                  </option>
                ))}
              </select>
              <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
                Pas dans la liste ? Ajoutez-le d'abord depuis Paramètres › Travaux pour tiers ›
                Clients.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="nf-name" className="mb-1 block text-xs font-medium">
              Nom de l'exploitation <span className="text-(--color-error)">*</span>
            </label>
            <input
              id="nf-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Domaine Pétroleux"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="nf-loc" className="mb-1 block text-xs font-medium">
              Localité
            </label>
            <input
              id="nf-loc"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex. Lausanne, VD"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="nf-cant" className="mb-1 block text-xs font-medium">
              Numéro cantonal{' '}
              <span className="text-[10px] font-normal text-(--color-muted)">(Acorda / GELAN)</span>
            </label>
            <input
              id="nf-cant"
              type="text"
              value={cantonalNumber}
              onChange={(e) => setCantonalNumber(e.target.value)}
              placeholder="VD-1234"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="nf-notes" className="mb-1 block text-xs font-medium">
              Notes
            </label>
            <textarea
              id="nf-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes libres sur l'exploitation"
              className="w-full rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/15"
            />
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-4 text-sm font-medium hover:bg-[#f8f8f5]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid}
            className="ml-auto inline-flex h-10 items-center rounded-(--radius) border border-(--color-primary) bg-(--color-primary) px-5 text-sm font-medium text-white hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            {ctaLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
