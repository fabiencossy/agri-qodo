import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useUsers, removeUser } from '../../users/users.store';
import { UserChip } from '../../users/UserSelect';
import type { AppUser, UserRole } from '../../users/users.types';
import { ROLE_LABELS } from '../../users/permissions';
import { useCan } from '../../users/permissions';
import { DataTable, type Column } from '../../../components/DataTable';
import { SearchBar, type FieldDescriptor, type SearchState } from '../../../components/SearchBar';
import type { ParametresOutletContext } from '../ParametresLayout';

type UserRow = AppUser;

export function UtilisateursSection() {
  const { mobileSelector } = useOutletContext<ParametresOutletContext>();
  const users = useUsers();
  const canAdmin = useCan('parametres', 'admin');
  const [showArchived, setShowArchived] = useState(false);

  const [searchState, setSearchState] = useState<SearchState>({
    facets: [],
    groupBy: [],
  });

  const fields: FieldDescriptor[] = useMemo(
    () => [
      {
        id: 'role',
        label: 'Rôle',
        type: 'select',
        options: (Object.keys(ROLE_LABELS) as UserRole[]).map((k) => ({
          label: ROLE_LABELS[k],
          value: k,
        })),
        groupable: true,
      },
      { id: 'fullName', label: 'Nom', type: 'text' },
      { id: 'email', label: 'Email', type: 'text' },
      { id: 'jobTitle', label: 'Poste', type: 'text' },
    ],
    [],
  );

  const allRows = useMemo<UserRow[]>(
    () => users.filter((u) => (showArchived ? true : u.active)),
    [users, showArchived],
  );

  const filtered = useMemo(() => {
    const q = (searchState.query ?? '').toLowerCase().trim();
    return allRows.filter((u) => {
      if (q) {
        const hay =
          `${u.fullName} ${u.displayName} ${u.email ?? ''} ${u.jobTitle ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const facet of searchState.facets) {
        if (facet.values.length === 0) continue;
        if (facet.fieldId === 'role') {
          if (!facet.values.includes(u.role)) return false;
        } else if (facet.fieldId === 'fullName') {
          if (!facet.values.some((v) => u.fullName.toLowerCase().includes(String(v).toLowerCase())))
            return false;
        } else if (facet.fieldId === 'email') {
          if (
            !facet.values.some((v) =>
              (u.email ?? '').toLowerCase().includes(String(v).toLowerCase()),
            )
          )
            return false;
        } else if (facet.fieldId === 'jobTitle') {
          if (
            !facet.values.some((v) =>
              (u.jobTitle ?? '').toLowerCase().includes(String(v).toLowerCase()),
            )
          )
            return false;
        }
      }
      return true;
    });
  }, [allRows, searchState]);

  const handleDelete = (u: AppUser) => {
    if (confirm(`Supprimer définitivement l'utilisateur ${u.fullName} ?`)) {
      removeUser(u.id);
    }
  };

  const newUserButton = canAdmin ? (
    <Link
      to="/parametres/utilisateurs/nouveau"
      aria-label="Nouvel utilisateur"
      title="Nouvel utilisateur"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius) bg-(--color-primary) text-white hover:bg-(--color-primary)/90 md:h-auto md:w-auto md:gap-1.5 md:px-3 md:py-2 md:text-xs md:font-semibold"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        width="18"
        height="18"
        aria-hidden="true"
        className="md:hidden"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="hidden md:inline">+ Nouvel utilisateur</span>
    </Link>
  ) : null;

  const activeCount = users.filter((u) => u.active).length;
  const archivedCount = users.length - activeCount;

  return (
    <div className="flex flex-col">
      {/* Toolbar desktop : titre + SearchBar + bouton inline */}
      <div className="sticky top-0 z-10 hidden items-center gap-3 border-b border-(--color-border) bg-(--color-bg) py-2 md:flex">
        <div className="shrink-0">
          <h2 className="m-0 text-sm font-semibold">Utilisateurs</h2>
          <span className="text-[11px] text-(--color-muted)">
            {activeCount} actif{activeCount > 1 ? 's' : ''}
            {archivedCount > 0 && ` · ${archivedCount} archivé${archivedCount > 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <SearchBar
            fields={fields}
            value={searchState}
            onChange={setSearchState}
            ariaLabel="Rechercher un utilisateur"
          />
        </div>
        <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-(--color-muted)">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Archivés
        </label>
        {newUserButton}
      </div>

      {/* Toolbar mobile : SearchBar + bouton + gear */}
      <div className="sticky top-0 z-10 flex flex-col gap-1 border-b border-(--color-border) bg-(--color-bg) pt-1 pb-1.5 md:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              fields={fields}
              value={searchState}
              onChange={setSearchState}
              ariaLabel="Rechercher un utilisateur"
            />
          </div>
          {newUserButton}
          {mobileSelector}
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-(--color-muted)">
            {activeCount} actif{activeCount > 1 ? 's' : ''}
            {archivedCount > 0 && ` · ${archivedCount} archivé${archivedCount > 1 ? 's' : ''}`}
          </span>
          <label className="inline-flex items-center gap-1.5 text-[10px] text-(--color-muted)">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Archivés
          </label>
        </div>
      </div>

      <div className="pt-1.5">
        <DataTable<UserRow>
          rows={filtered}
          getId={(u) => u.id}
          emptyMessage="Aucun utilisateur ne correspond à cette recherche."
          entityLabel="utilisateur"
          columns={userColumns({ canAdmin, handleDelete })}
          groupBy={
            searchState.groupBy.some((g) => g.fieldId === 'role')
              ? {
                  getKey: (u) => u.role,
                  getLabel: (k) => ROLE_LABELS[k as UserRole] ?? k,
                }
              : undefined
          }
          renderMobileCard={(u, { checkbox }) => (
            <>
              <div className="shrink-0 pt-0.5">{checkbox}</div>
              <UserChip user={u} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {u.fullName}
                  </span>
                  {!u.active && (
                    <span className="rounded-(--radius-pill) bg-[#f1f1ee] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-muted) uppercase">
                      Archivé
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-(--color-muted)">
                  {u.email ?? '—'}
                  {u.jobTitle && ` · ${u.jobTitle}`}
                </div>
              </div>
            </>
          )}
        />
      </div>
    </div>
  );
}

function userColumns(opts: {
  canAdmin: boolean;
  handleDelete: (u: AppUser) => void;
}): Column<UserRow>[] {
  const { canAdmin, handleDelete } = opts;
  return [
    {
      key: 'avatar',
      label: '',
      width: 'w-12',
      render: (u) => <UserChip user={u} size={32} />,
    },
    {
      key: 'name',
      label: 'Nom',
      render: (u) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{u.fullName}</span>
            {!u.active && (
              <span className="rounded-(--radius-pill) bg-[#f1f1ee] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-(--color-muted) uppercase">
                Archivé
              </span>
            )}
          </div>
          {u.jobTitle && (
            <div className="truncate text-[11px] text-(--color-muted)">{u.jobTitle}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (u) => <span className="text-(--color-muted)">{u.email ?? '—'}</span>,
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (u) => (
        <span className="text-(--color-muted)">
          {ROLE_LABELS[u.role]}
          {u.permissions && ' · custom'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/parametres/utilisateurs/${u.id}`}
            className="rounded-(--radius) border border-(--color-border) bg-white px-2 py-1 text-xs font-medium hover:bg-[#fbfbf9]"
          >
            {canAdmin ? 'Modifier' : 'Voir'}
          </Link>
          {canAdmin && (
            <button
              type="button"
              onClick={() => handleDelete(u)}
              aria-label={`Supprimer ${u.fullName}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius) text-(--color-error) hover:bg-[#fef2f2]"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      ),
    },
  ];
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
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
