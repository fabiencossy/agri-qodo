"use client";

import { RefreshCw, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import {
  MATERIEL_CATEGORIE_LABEL,
  MATERIEL_CATEGORIES_ORDER,
  MATERIEL_UNITE_LABEL,
  type Materiel,
  type MaterielCategorie,
  type SyncOdooMaterielsResult,
  useMateriels,
  useSyncMaterielsOdoo,
} from "@/lib/materiels";
import { useOdooConnected } from "@/lib/odoo-config";

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
}

export default function MaterielsPage() {
  const [filtre, setFiltre] = useState<MaterielCategorie | "ALL">("ALL");
  const [syncResult, setSyncResult] = useState<SyncOdooMaterielsResult | null>(null);
  const materiels = useMateriels(filtre === "ALL" ? undefined : filtre);
  const syncOdoo = useSyncMaterielsOdoo();
  const me = useCurrentUser();
  const odoo = useOdooConnected();
  const isAdmin = me.data?.role === "OWNER" || me.data?.role === "COMPTABLE";

  const handleSyncOdoo = () => {
    syncOdoo.mutate(undefined, {
      onSuccess: (r) => setSyncResult(r),
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<MaterielCategorie, Materiel[]>();
    for (const m of materiels.data ?? []) {
      const arr = map.get(m.categorie) ?? [];
      arr.push(m);
      map.set(m.categorie, arr);
    }
    return MATERIEL_CATEGORIES_ORDER.map((c) => [c, map.get(c) ?? []] as const).filter(
      ([, list]) => list.length > 0,
    );
  }, [materiels.data]);

  return (
    <>
      <Breadcrumb
        items={[{ label: "Accueil", href: "/app" }, { label: "Catalogue prestations" }]}
      />
      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-8">
        <PageHeader
          title="Catalogue prestations"
          icon={Wrench}
          subtitle="Travaux facturables : labour, semis, ensilage, balles rondes… Tarifs Agridea modifiables. Mappés Odoo product.product type=service."
        />

        {isAdmin && odoo.connected && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 sm:px-5">
            <RefreshCw className="h-5 w-5 flex-shrink-0 text-amber-700" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">Synchronisation Odoo</p>
              <p className="mt-0.5 text-xs text-foreground/70">
                Importe tous les <code className="font-mono">product.product</code> de type{" "}
                <code className="font-mono">service</code> depuis ton instance Odoo.
              </p>
            </div>
            <Button
              onClick={handleSyncOdoo}
              disabled={syncOdoo.isPending}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${syncOdoo.isPending ? "animate-spin" : ""}`} />
              {syncOdoo.isPending ? "Sync…" : "Synchroniser"}
            </Button>
          </div>
        )}

        {syncResult && (
          <div className="mb-4 rounded-xl border border-green/30 bg-green/5 p-4 text-sm">
            <p className="font-medium text-green-dark">
              ✓ Sync Odoo terminée : {syncResult.created} créés · {syncResult.updated} mis à jour ·{" "}
              {syncResult.skipped} ignorés
              {syncResult.total > 0 && ` (sur ${syncResult.total} services Odoo)`}
            </p>
            {syncResult.errors.length > 0 && (
              <details className="mt-2 text-xs text-foreground/70">
                <summary className="cursor-pointer">{syncResult.errors.length} erreur(s)</summary>
                <ul className="mt-1 list-disc pl-5">
                  {syncResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      Odoo #{e.odooId} : {e.raison}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {syncOdoo.isError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Sync Odoo échouée. Vérifie la config dans Paramètres → Odoo.
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <FiltreChip active={filtre === "ALL"} onClick={() => setFiltre("ALL")} label="Tous" />
          {MATERIEL_CATEGORIES_ORDER.map((c) => (
            <FiltreChip
              key={c}
              active={filtre === c}
              onClick={() => setFiltre(c)}
              label={MATERIEL_CATEGORIE_LABEL[c]}
            />
          ))}
        </div>

        {materiels.isLoading && <div className="text-sm text-foreground/60">Chargement…</div>}
        {materiels.isError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le catalogue.
          </div>
        )}

        {grouped.length === 0 && materiels.data && (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-foreground/60">
            Aucun matériel dans cette catégorie.
          </div>
        )}

        <div className="space-y-8">
          {grouped.map(([categorie, list]) => (
            <section key={categorie}>
              <h2 className="mb-3 text-lg font-semibold">{MATERIEL_CATEGORIE_LABEL[categorie]}</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-foreground/60">
                    <tr>
                      <th className="px-4 py-2">Libellé</th>
                      <th className="px-4 py-2">Unité</th>
                      <th className="px-4 py-2 text-right">Tarif</th>
                      <th className="px-4 py-2 text-right">Odoo</th>
                      <th className="px-4 py-2 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.id} className="border-t border-border align-top">
                        <td className="px-4 py-2">
                          <div className="font-medium">{m.libelle}</div>
                          {m.notes && <div className="text-xs text-foreground/60">{m.notes}</div>}
                        </td>
                        <td className="px-4 py-2 text-foreground/70">
                          {MATERIEL_UNITE_LABEL[m.unite]}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                          {m.prixUnitaireCHF ? (
                            <>
                              {formatCHF(Number(m.prixUnitaireCHF))}
                              <span className="text-foreground/40">
                                /{MATERIEL_UNITE_LABEL[m.unite]}
                              </span>
                            </>
                          ) : (
                            <span className="text-foreground/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {m.odooProductId ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              #{m.odooProductId}
                            </span>
                          ) : (
                            <span className="text-foreground/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {m.tenantId === null ? (
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                              global
                            </span>
                          ) : (
                            <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs text-green">
                              perso
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

function FiltreChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-green text-white"
          : "border border-border bg-background text-foreground/70 hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
