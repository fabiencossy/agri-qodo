import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useUsers, addUser, updateUser } from '../../users/users.store';
import type { AppUser, ModuleKey, PermissionLevel, UserRole } from '../../users/users.types';
import {
  MODULE_KEYS,
  MODULE_LABELS,
  PERMISSION_LABELS,
  PERMISSION_ORDER,
  ROLE_DEFAULTS,
  ROLE_LABELS,
  useCan,
} from '../../users/permissions';
import { Field, PrimaryButton, SecondaryButton, SectionCard } from './_shared';
import { inputClass, selectClass } from './_styles';

const ROLES: UserRole[] = ['admin', 'editor', 'viewer'];
const LEVELS: PermissionLevel[] = [...PERMISSION_ORDER];
const DEFAULT_COLORS = [
  '#2d5016',
  '#875a7b',
  '#a16207',
  '#0284c7',
  '#dc2626',
  '#16a34a',
  '#6b7280',
];

export function UtilisateurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'nouveau';
  const navigate = useNavigate();
  const users = useUsers();
  const canAdmin = useCan('parametres', 'admin');
  const existing = !isNew ? users.find((u) => u.id === id) : undefined;

  const [draft, setDraft] = useState<Partial<AppUser>>(() => ({
    role: 'editor',
    active: true,
    color: DEFAULT_COLORS[0],
    language: 'fr',
    ...existing,
  }));
  const [customPerms, setCustomPerms] = useState<boolean>(() => Boolean(existing?.permissions));

  // Permissions effectives (rôle ou override)
  const effectivePerms = useMemo<Record<ModuleKey, PermissionLevel>>(() => {
    const base = ROLE_DEFAULTS[(draft.role ?? 'editor') as UserRole];
    if (!customPerms) return { ...base };
    return MODULE_KEYS.reduce<Record<ModuleKey, PermissionLevel>>(
      (acc, k) => {
        acc[k] = draft.permissions?.[k] ?? base[k];
        return acc;
      },
      {} as Record<ModuleKey, PermissionLevel>,
    );
  }, [draft.role, draft.permissions, customPerms]);

  if (!isNew && !existing) {
    return <Navigate to="/parametres/utilisateurs" replace />;
  }

  const setField = <K extends keyof AppUser>(k: K, v: AppUser[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setPerm = (module: ModuleKey, level: PermissionLevel) => {
    setDraft((d) => ({
      ...d,
      permissions: { ...effectivePerms, [module]: level },
    }));
    setCustomPerms(true);
  };

  const toggleCustomPerms = (on: boolean) => {
    setCustomPerms(on);
    if (!on) {
      setDraft((d) => ({ ...d, permissions: undefined }));
    } else {
      setDraft((d) => ({ ...d, permissions: { ...effectivePerms } }));
    }
  };

  const submit = () => {
    if (!draft.fullName?.trim() || !draft.displayName?.trim()) return;
    const initials =
      draft.initials?.toUpperCase().slice(0, 2) ??
      draft.fullName
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    const user: AppUser = {
      id: draft.id ?? `U-${Date.now()}`,
      displayName: draft.displayName,
      fullName: draft.fullName,
      email: draft.email,
      phone: draft.phone,
      jobTitle: draft.jobTitle,
      hireDate: draft.hireDate,
      language: draft.language ?? 'fr',
      role: draft.role ?? 'editor',
      color: draft.color ?? DEFAULT_COLORS[0]!,
      initials,
      active: draft.active ?? true,
      permissions: customPerms ? draft.permissions : undefined,
      odooEmployeeId: draft.odooEmployeeId,
      odooUserId: draft.odooUserId,
      odooTagId: draft.odooTagId,
    };
    if (isNew) addUser(user);
    else if (draft.id) updateUser(draft.id, user);
    navigate('/parametres/utilisateurs');
  };

  const headerInitials =
    draft.initials ??
    (draft.fullName
      ?.split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ||
      '??');

  return (
    <div className="space-y-4">
      {/* Header style Odoo : avatar + nom + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/parametres/utilisateurs"
          className="inline-flex h-9 items-center gap-1.5 rounded-(--radius) border border-(--color-border) bg-(--color-surface) px-3 text-xs font-medium hover:bg-[#f8f8f5]"
        >
          ← Retour
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-(--radius-pill) text-base font-semibold text-white"
            style={{ background: draft.color ?? DEFAULT_COLORS[0] }}
            aria-hidden
          >
            {headerInitials}
          </div>
          <div>
            <h2 className="m-0 text-base font-semibold">
              {draft.fullName || (isNew ? 'Nouvel utilisateur' : 'Utilisateur')}
            </h2>
            <p className="m-0 text-xs text-(--color-muted)">
              {ROLE_LABELS[draft.role ?? 'editor']}
              {draft.jobTitle && ` · ${draft.jobTitle}`}
            </p>
          </div>
        </div>
        {canAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <SecondaryButton onClick={() => navigate('/parametres/utilisateurs')}>
              Annuler
            </SecondaryButton>
            <PrimaryButton
              onClick={submit}
              disabled={!draft.fullName?.trim() || !draft.displayName?.trim()}
            >
              {isNew ? 'Créer' : 'Enregistrer'}
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* Informations personnelles */}
      <SectionCard title="Informations personnelles">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nom complet" required>
            <input
              type="text"
              value={draft.fullName ?? ''}
              onChange={(e) => setField('fullName', e.target.value)}
              className={inputClass}
              disabled={!canAdmin}
              placeholder="Ex. Fabien Cossy"
              autoFocus
            />
          </Field>
          <Field label="Nom usuel (affichage)" required>
            <input
              type="text"
              value={draft.displayName ?? ''}
              onChange={(e) => setField('displayName', e.target.value)}
              className={inputClass}
              disabled={!canAdmin}
              placeholder="Ex. F. Cossy"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={draft.email ?? ''}
              onChange={(e) => setField('email', e.target.value || undefined)}
              className={inputClass}
              disabled={!canAdmin}
              placeholder="prenom.nom@exploitation.ch"
            />
          </Field>
          <Field label="Téléphone">
            <input
              type="tel"
              value={draft.phone ?? ''}
              onChange={(e) => setField('phone', e.target.value || undefined)}
              className={inputClass}
              disabled={!canAdmin}
              placeholder="+41 79 ..."
            />
          </Field>
          <Field label="Poste / fonction">
            <input
              type="text"
              value={draft.jobTitle ?? ''}
              onChange={(e) => setField('jobTitle', e.target.value || undefined)}
              className={inputClass}
              disabled={!canAdmin}
              placeholder="Ex. Tractoriste"
            />
          </Field>
          <Field label="Date d'entrée">
            <input
              type="date"
              value={draft.hireDate ?? ''}
              onChange={(e) => setField('hireDate', e.target.value || undefined)}
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
          <Field label="Couleur d'avatar">
            <div className="flex flex-wrap gap-2 pt-1">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField('color', c)}
                  aria-label={`Couleur ${c}`}
                  disabled={!canAdmin}
                  className={[
                    'h-7 w-7 rounded-(--radius-pill) border-2 transition-all',
                    draft.color === c ? 'border-(--color-text) scale-110' : 'border-transparent',
                  ].join(' ')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
          <Field label="Statut">
            <select
              value={String(draft.active ?? true)}
              onChange={(e) => setField('active', e.target.value === 'true')}
              className={selectClass}
              disabled={!canAdmin}
            >
              <option value="true">Actif</option>
              <option value="false">Archivé</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* Accès & droits */}
      <SectionCard title="Accès & droits" description="Rôle global et niveaux fins par module">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Rôle global">
            <select
              value={draft.role ?? 'editor'}
              onChange={(e) => setField('role', e.target.value as UserRole)}
              className={selectClass}
              disabled={!canAdmin}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Langue d'interface">
            <select
              value={draft.language ?? 'fr'}
              onChange={(e) =>
                setField('language', e.target.value as NonNullable<AppUser['language']>)
              }
              className={selectClass}
              disabled={!canAdmin}
            >
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>

        <div className="mt-4 rounded-(--radius-sm) border border-(--color-border) bg-[#fbfbf9] p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={customPerms}
              onChange={(e) => toggleCustomPerms(e.target.checked)}
              disabled={!canAdmin}
            />
            Personnaliser les droits par module
          </label>
          <p className="m-0 mt-1 text-[11px] text-(--color-muted)">
            Sans personnalisation : utilise les défauts du rôle «{' '}
            {ROLE_LABELS[draft.role ?? 'editor']} ».
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-(--color-border) text-left text-[10px] font-semibold tracking-wider text-(--color-muted) uppercase">
                <th className="py-2 pr-2">Module</th>
                {LEVELS.map((l) => (
                  <th key={l} className="px-2 py-2 text-center">
                    {PERMISSION_LABELS[l]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_KEYS.map((m) => (
                <tr key={m} className="border-b border-(--color-border) text-sm">
                  <td className="py-2 pr-2 font-medium">{MODULE_LABELS[m]}</td>
                  {LEVELS.map((l) => {
                    const isActive = effectivePerms[m] === l;
                    const isInherited =
                      !customPerms && ROLE_DEFAULTS[(draft.role ?? 'editor') as UserRole][m] === l;
                    return (
                      <td key={l} className="px-2 py-2 text-center">
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <input
                            type="radio"
                            name={`perm-${m}`}
                            checked={isActive}
                            onChange={() => setPerm(m, l)}
                            disabled={!canAdmin}
                          />
                          {isInherited && (
                            <span className="ml-1 text-[10px] text-(--color-muted)">(défaut)</span>
                          )}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Liaison Odoo */}
      <SectionCard
        title="Synchronisation Odoo"
        description="Mapping Field Service — à configurer en Phase 3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Étiquette Field Service (project.tags)"
            hint="L'étiquette Odoo dédiée à cet employé. C'est elle qui sera ajoutée à task.tag_ids pour signaler que la tâche lui est assignée (convention du projet)."
          >
            <input
              type="number"
              value={draft.odooTagId ?? ''}
              onChange={(e) =>
                setField(
                  'odooTagId',
                  e.target.value ? Number(e.target.value) : (undefined as never),
                )
              }
              placeholder="ID project.tags"
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
          <Field
            label="ID employé (hr.employee)"
            hint="Référence employé dans Odoo. Utilisé pour les timesheets (account.analytic.line.employee_id)."
          >
            <input
              type="number"
              value={draft.odooEmployeeId ?? ''}
              onChange={(e) =>
                setField(
                  'odooEmployeeId',
                  e.target.value ? Number(e.target.value) : (undefined as never),
                )
              }
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
          <Field
            label="ID utilisateur (res.users) — optionnel"
            hint="Uniquement si l'employé a un compte Odoo avec licence (rare). Permet d'ajouter la tâche à son tableau de bord personnel."
          >
            <input
              type="number"
              value={draft.odooUserId ?? ''}
              onChange={(e) =>
                setField(
                  'odooUserId',
                  e.target.value ? Number(e.target.value) : (undefined as never),
                )
              }
              className={inputClass}
              disabled={!canAdmin}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
