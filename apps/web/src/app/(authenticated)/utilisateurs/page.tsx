"use client";

import { Plus, Trash2, UserCog, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth";
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const isOwner = me.data?.role === "OWNER";

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
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un utilisateur
            </Button>
          )}
        </div>

        {!isOwner && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Seul le propriétaire (OWNER) peut ajouter ou modifier des utilisateurs. Tu peux voir la
            liste et modifier ton propre profil via la page Compte.
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
                  <UserRow key={u.id} user={u} isOwner={isOwner} isMe={u.id === me.data?.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && <NewUserDialog onClose={() => setDialogOpen(false)} />}
    </>
  );
}

function UserRow({ user, isOwner, isMe }: { user: User; isOwner: boolean; isMe: boolean }) {
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();

  const onChangeRole = (role: UserRole) => {
    if (!isOwner || isMe) return;
    updateMut.mutate({ id: user.id, role });
  };

  const onToggleActive = () => {
    if (!isOwner || isMe) return;
    updateMut.mutate({ id: user.id, isActive: !user.isActive });
  };

  const onDelete = () => {
    if (!isOwner || isMe) return;
    if (!confirm(`Supprimer ${user.prenom} ${user.nom} ?`)) return;
    deleteMut.mutate(user.id);
  };

  return (
    <tr className={`border-t border-border ${user.isActive ? "" : "opacity-50"}`}>
      <td className="px-4 py-2 font-medium">
        {user.prenom} {user.nom}
        {isMe && <span className="ml-2 text-xs text-foreground/60">(toi)</span>}
      </td>
      <td className="px-4 py-2 text-foreground/70">{user.email}</td>
      <td className="px-4 py-2">
        {isOwner && !isMe ? (
          <select
            value={user.role}
            onChange={(e) => onChangeRole(e.target.value as UserRole)}
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
