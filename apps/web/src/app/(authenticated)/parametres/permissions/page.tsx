"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/components/app/breadcrumb";

/**
 * Placeholder de l'écran ACL employés.
 *
 * V1 livrée dans cette PR : centralise l'idée et expose la matrice
 * indicative. L'enforcement réel module-par-module (interventions,
 * suisse-bilanz, animaux, etc.) viendra dans une PR dédiée — c'est un
 * chantier transverse qui touche tous les services.
 */
const MODULES = [
  { key: "parcelles", label: "Parcelles" },
  { key: "interventions", label: "Carnet des champs" },
  { key: "animaux", label: "Cheptel" },
  { key: "srpa", label: "SRPA" },
  { key: "produits", label: "Catalogue produits" },
  { key: "suisse_bilanz", label: "Suisse-Bilanz" },
  { key: "plan_fumure", label: "Plan de fumure" },
  { key: "assolement", label: "Plan d'assolement" },
];

const ROLES_DEFAULT_PERMS = {
  OWNER: { label: "Chef d'exploitation", read: true, write: true, isAll: true },
  EMPLOYE: { label: "Salarié", read: true, write: true, isAll: false },
  COMPTABLE: { label: "Comptable", read: true, write: false, isAll: false },
  CONSULTANT: { label: "Conseiller (Agridea, fiduciaire)", read: true, write: false, isAll: false },
} as const;

export default function PermissionsPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Paramètres", href: "/parametres" },
          { label: "Rôles et permissions" },
        ]}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/parametres" className="text-foreground/60 hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ShieldCheck className="h-7 w-7 text-green" />
            Rôles et permissions
          </h1>
        </div>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Bientôt disponible.</strong> L'édition fine des permissions par employé sera
          ajoutée dans une prochaine version. Ci-dessous, la matrice par défaut associée à chaque
          rôle aujourd'hui — gérée via la page{" "}
          <Link href="/utilisateurs" className="underline">
            Utilisateurs
          </Link>
          .
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="px-4 py-2">Module</th>
                {Object.values(ROLES_DEFAULT_PERMS).map((r) => (
                  <th key={r.label} className="px-4 py-2 text-center">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{m.label}</td>
                  {Object.entries(ROLES_DEFAULT_PERMS).map(([role, perms]) => (
                    <td key={role} className="px-4 py-2 text-center">
                      <PermBadge read={perms.read} write={perms.write} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-foreground/60">
          Légende — <strong className="text-emerald-700">L+E</strong> : lecture + écriture
          autorisées. <strong className="text-blue-700">L</strong> : lecture seule.{" "}
          <strong className="text-foreground/40">—</strong> : aucun accès.
        </p>
      </div>
    </>
  );
}

function PermBadge({ read, write }: { read: boolean; write: boolean }) {
  if (write && read) {
    return (
      <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        L+E
      </span>
    );
  }
  if (read) {
    return (
      <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
        L
      </span>
    );
  }
  return <span className="text-foreground/30">—</span>;
}
