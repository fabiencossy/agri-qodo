"use client";

import { Plus, Trash2, UserCog, Users as UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth";
import { type OdooEmployee, useOdooEmployees } from "@/lib/odoo-employees";
import {
  ROLE_LABEL,
  ROLES_ORDER,
  type User,
  type UserRole,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "@/lib/users";

export default function UtilisateursPage() {
  const users = useUsers();
  const me = useCurrentUser();
  const employees = useOdooEmployees();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const isOwner = me.data?.role === "OWNER";
  const odooEmployees = employees.data ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Utilisateurs" }]} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <UsersIcon className="h-7 w-7 text-green" />
              Utilisateurs de l'exploitation
            </h1>
            <p className="mt-1 text-foreground/70">
              {users.data
                ? `${users.data.length} utilisateur${users.data.length > 1 ? "s" : ""}`
                : "Chargement…"}
            </p>
          </div>
          {isOwner && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un utilisateur
            </Button>
          )}
        </div>

        {!isOwner && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Seul le propriétaire (OWNER) peut ajouter ou modifier d'autres utilisateurs. Tu peux
            cependant cliquer sur ta propre ligne pour modifier ton profil.
          </div>
        )}

        {users.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger la liste.
          </div>
        )}

        {users.data && (
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Rôle</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isOwner={isOwner}
                    isMe={u.id === me.data?.id}
                    odooEmployees={odooEmployees}
                    onOpen={() => setEditingUser(u)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isOwner && employees.isFetched && odooEmployees.length === 0 && (
          <p className="mt-3 text-xs text-foreground/60">
            Aucun employé Odoo détecté. Configure Odoo dans{" "}
            <span className="font-mono">/parametres</span> et active le module Employés (HR) pour
            mapper les comptes aux feuilles de temps.
          </p>
        )}
      </div>

      {createOpen && <NewUserDialog onClose={() => setCreateOpen(false)} />}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          isOwner={isOwner}
          isMe={editingUser.id === me.data?.id}
          odooEmployees={odooEmployees}
          onClose={() => setEditingUser(null)}
        />
      )}
    </>
  );
}

function UserRow({
  user,
  isOwner,
  isMe,
  odooEmployees,
  onOpen,
}: {
  user: User;
  isOwner: boolean;
  isMe: boolean;
  odooEmployees: OdooEmployee[];
  onOpen: () => void;
}) {
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();

  const odooEmployeeName = (() => {
    if (!user.odooEmployeeId) return null;
    return (
      odooEmployees.find((e) => e.odooId === user.odooEmployeeId)?.name ??
      `Odoo #${user.odooEmployeeId}`
    );
  })();

  // Le rôle reste éditable inline (action rapide la plus fréquente
  // selon Fabien) — le dialog s'ouvre pour tout le reste.
  const onChangeRole = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (!isOwner || isMe) return;
    updateMut.mutate({ id: user.id, role: e.target.value as UserRole });
  };

  const onToggleActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner || isMe) return;
    updateMut.mutate({ id: user.id, isActive: !user.isActive });
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner || isMe) return;
    if (!confirm(`Supprimer ${user.prenom} ${user.nom} ?`)) return;
    deleteMut.mutate(user.id);
  };

  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-t border-border transition-colors hover:bg-muted/40 ${
        user.isActive ? "" : "opacity-50"
      }`}
    >
      <td className="px-4 py-2 font-medium">
        {user.prenom} {user.nom}
        {isMe && <span className="ml-2 text-xs text-foreground/60">(toi)</span>}
        {odooEmployeeName && (
          <span
            className="ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/60"
            title="Mapping vers hr.employee Odoo (timesheets)"
          >
            Odoo: {odooEmployeeName}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-foreground/70">{user.email}</td>
      <td className="px-4 py-2">
        {isOwner && !isMe ? (
          <select
            value={user.role}
            onClick={(e) => e.stopPropagation()}
            onChange={onChangeRole}
            disabled={updateMut.isPending}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {ROLES_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        ) : (
          ROLE_LABEL[user.role]
        )}
      </td>
      <td className="px-4 py-2">
        {user.isActive ? (
          <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs text-green">actif</span>
        ) : (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">désactivé</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {isOwner && !isMe && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onToggleActive}
              disabled={updateMut.isPending}
              className="text-foreground/60 hover:text-foreground"
              title={user.isActive ? "Désactiver" : "Réactiver"}
            >
              <UserCog className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              disabled={deleteMut.isPending}
              className="text-foreground/50 hover:text-red-600"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function EditUserDialog({
  user,
  isOwner,
  isMe,
  odooEmployees,
  onClose,
}: {
  user: User;
  isOwner: boolean;
  isMe: boolean;
  odooEmployees: OdooEmployee[];
  onClose: () => void;
}) {
  const [prenom, setPrenom] = useState(user.prenom);
  const [nom, setNom] = useState(user.nom);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [odooEmployeeId, setOdooEmployeeId] = useState<number | null>(user.odooEmployeeId);
  const [password, setPassword] = useState("");
  const update = useUpdateUser();
  const del = useDeleteUser();

  // Resync si la liste sous-jacente change pendant que le dialog est ouvert.
  useEffect(() => {
    setPrenom(user.prenom);
    setNom(user.nom);
    setRole(user.role);
    setIsActive(user.isActive);
    setOdooEmployeeId(user.odooEmployeeId);
  }, [user]);

  const canEditOthers = isOwner && !isMe;
  const canEditSelf = isMe;
  const canEdit = canEditOthers || canEditSelf;
  const showOdooField = isOwner && odooEmployees.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const patch: Parameters<typeof update.mutate>[0] = { id: user.id };
    if (prenom !== user.prenom) patch.prenom = prenom;
    if (nom !== user.nom) patch.nom = nom;
    if (canEditOthers) {
      if (role !== user.role) patch.role = role;
      if (isActive !== user.isActive) patch.isActive = isActive;
    }
    if (canEditOthers && odooEmployeeId !== user.odooEmployeeId) {
      patch.odooEmployeeId = odooEmployeeId;
    }
    if (password) patch.password = password;
    update.mutate(patch, { onSuccess: () => onClose() });
  };

  const onDelete = () => {
    if (!canEditOthers) return;
    if (!confirm(`Supprimer définitivement ${user.prenom} ${user.nom} ?`)) return;
    del.mutate(user.id, { onSuccess: () => onClose() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">
          {isMe ? "Mon compte" : `${user.prenom} ${user.nom}`}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                disabled={!canEdit || update.isPending}
                required
              />
            </Field>
            <Field label="Nom">
              <Input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                disabled={!canEdit || update.isPending}
                required
              />
            </Field>
          </div>

          <Field label="Email">
            <Input value={user.email} disabled readOnly />
            <p className="mt-1 text-xs text-foreground/60">
              L'email est lié à la connexion — non modifiable depuis cette page.
            </p>
          </Field>

          <Field label="Rôle">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={!canEditOthers || update.isPending}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ROLES_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {!canEditOthers && (
              <p className="mt-1 text-xs text-foreground/60">
                Seul le propriétaire peut changer le rôle.
              </p>
            )}
          </Field>

          {canEditOthers && (
            <Field label="Statut">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={update.isPending}
                  className="h-4 w-4 cursor-pointer accent-green"
                />
                <span className="text-sm">
                  Compte actif{" "}
                  {!isActive && <span className="text-foreground/60">(désactivé)</span>}
                </span>
              </label>
              <p className="mt-1 text-xs text-foreground/60">
                Désactiver révoque immédiatement les sessions.
              </p>
            </Field>
          )}

          {showOdooField && (
            <Field label="Employé Odoo (timesheets)">
              <select
                value={odooEmployeeId ?? ""}
                onChange={(e) =>
                  setOdooEmployeeId(e.target.value === "" ? null : Number(e.target.value))
                }
                disabled={!canEditOthers || update.isPending}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">— non mappé —</option>
                {odooEmployees.map((emp) => (
                  <option key={emp.odooId} value={emp.odooId}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-foreground/60">
                Les heures saisies sur les Travaux remontent sur cet employé Odoo (
                <span className="font-mono">hr.employee</span>).
              </p>
            </Field>
          )}

          <Field label={canEditOthers ? "Réinitialiser le mot de passe" : "Nouveau mot de passe"}>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={update.isPending}
              minLength={4}
              placeholder="Laisser vide pour ne pas changer"
            />
            {password && (
              <p className="mt-1 text-xs text-foreground/60">
                {canEditOthers
                  ? "Communique le nouveau mot de passe à l'utilisateur — il pourra le changer après connexion."
                  : "Les autres sessions seront déconnectées."}
              </p>
            )}
          </Field>

          {update.isError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {update.error instanceof Error ? update.error.message : "Erreur"}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {canEditOthers ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={del.isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={!canEdit || update.isPending}>
                {update.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewUserDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<UserRole>("EMPLOYE");
  const create = useCreateUser();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { email, password, prenom, nom, role },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold">Ajouter un utilisateur</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom *">
              <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            </Field>
            <Field label="Nom *">
              <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
            </Field>
          </div>
          <Field label="Email *">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Mot de passe initial *">
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              placeholder="Au moins 4 caractères"
            />
            <p className="mt-1 text-xs text-foreground/60">
              Communique-le à l'utilisateur — il pourra le changer après connexion.
            </p>
          </Field>
          <Field label="Rôle">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-base"
            >
              {ROLES_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          {create.isError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {create.error instanceof Error ? create.error.message : "Erreur"}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Création…" : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
