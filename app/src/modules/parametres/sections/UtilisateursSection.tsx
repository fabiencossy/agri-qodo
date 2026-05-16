import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsers, removeUser } from '../../users/users.store';
import { UserChip } from '../../users/UserSelect';
import type { AppUser } from '../../users/users.types';
import { ROLE_LABELS } from '../../users/permissions';
import { useCan } from '../../users/permissions';
import { SectionCard, PrimaryButton, SecondaryButton, DangerButton, EmptyState } from './_shared';
import { inputClass } from './_styles';

export function UtilisateursSection() {
  const users = useUsers();
  const canAdmin = useCan('parametres', 'admin');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filtered = users
    .filter((u) => (showArchived ? true : u.active))
    .filter((u) => {
      if (!search.trim()) return true;
      const lc = search.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(lc) ||
        u.displayName.toLowerCase().includes(lc) ||
        (u.email ?? '').toLowerCase().includes(lc) ||
        (u.jobTitle ?? '').toLowerCase().includes(lc)
      );
    });

  const handleDelete = (u: AppUser) => {
    if (confirm(`Supprimer définitivement l'utilisateur ${u.fullName} ?`)) {
      removeUser(u.id);
    }
  };

  return (
    <SectionCard
      title={`${filtered.length} utilisateur${filtered.length > 1 ? 's' : ''}`}
      actions={
        canAdmin && (
          <Link to="/parametres/utilisateurs/nouveau">
            <PrimaryButton>+ Nouvel utilisateur</PrimaryButton>
          </Link>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, email, poste)"
          className={`${inputClass} max-w-sm`}
        />
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-(--color-muted)">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Voir les archivés
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>Aucun utilisateur ne correspond à cette recherche.</EmptyState>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-3"
            >
              <UserChip user={u} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm font-medium">{u.fullName}</span>
                  {u.jobTitle && (
                    <span className="truncate text-[11px] text-(--color-muted)">
                      · {u.jobTitle}
                    </span>
                  )}
                  {!u.active && (
                    <span className="rounded-(--radius-pill) bg-[#f1f1ee] px-1.5 py-0.5 text-[10px] font-medium text-(--color-muted)">
                      Archivé
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-(--color-muted)">
                  {u.email ?? '—'} · {ROLE_LABELS[u.role]}
                  {u.permissions && ' · droits personnalisés'}
                </div>
              </div>
              <Link to={`/parametres/utilisateurs/${u.id}`}>
                <SecondaryButton>{canAdmin ? 'Modifier' : 'Voir'}</SecondaryButton>
              </Link>
              {canAdmin && (
                <DangerButton
                  onClick={() => handleDelete(u)}
                  aria-label={`Supprimer ${u.fullName}`}
                  className="!h-9 !w-9 !px-0 !justify-center"
                >
                  <TrashIcon />
                </DangerButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
