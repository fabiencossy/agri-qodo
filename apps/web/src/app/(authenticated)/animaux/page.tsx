"use client";

/**
 * Cheptel — `/animaux`.
 *
 * Liste détaillée de tous les animaux avec ResourceView (liste/kanban,
 * recherche Odoo-like, filtres, regroupements, favoris). En haut :
 * total UGB + bouton import BDTA. Plus de "vue compteurs" séparée.
 */
import { Beef, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ImportBdtaDialog } from "@/components/animaux/import-bdta-dialog";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import {
  type Animal,
  type AnimalFamille,
  bvdBadge,
  FAMILLE_BY_CATEGORIE,
  isBovin,
  libelleLabel,
  libelleUsage,
  useAnimaux,
  useUgb,
} from "@/lib/animaux";
import {
  type AnimalCategorie,
  CATEGORIES_ORDER,
  emojiCategorie,
  libelleCategorie,
} from "@/lib/srpa";

const FAMILLE_ORDER: AnimalFamille[] = [
  "Bovins",
  "Ovins",
  "Caprins",
  "Équidés",
  "Cervidés",
  "Camélidés",
  "Porcins",
  "Volailles",
  "Petits élevages",
  "Autres",
];

function formatDateNaissance(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ageMs = Date.now() - d.getTime();
  const ageAns = ageMs / (365.25 * 86_400_000);
  const dateFr = d.toLocaleDateString("fr-CH");
  if (ageAns < 1) {
    const mois = Math.floor(ageMs / (30 * 86_400_000));
    return `${dateFr} (${mois} mois)`;
  }
  return `${dateFr} (${ageAns.toFixed(1)} ans)`;
}

function ageAns(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 86_400_000);
}

function formatUgb(n: number): string {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CheptelPage() {
  const router = useRouter();
  const animauxQuery = useAnimaux();
  const ugb = useUgb();
  const [importOpen, setImportOpen] = useState(false);
  const animaux = useMemo(() => animauxQuery.data ?? [], [animauxQuery.data]);

  const filters = useMemo<FilterOption<Animal>[]>(
    () => [
      { key: "identified", label: "Identifiés (n° boucle)", predicate: (a) => !!a.numeroBoucle },
      { key: "non-identified", label: "Sans identification", predicate: (a) => !a.numeroBoucle },
      { key: "with-name", label: "Avec un nom", predicate: (a) => !!a.nom },
      { key: "alive", label: "Vivants", predicate: (a) => !a.dateMort },
      { key: "dead", label: "Morts", predicate: (a) => !!a.dateMort },
      {
        key: "young",
        label: "Jeunes (< 1 an)",
        predicate: (a) => {
          const age = ageAns(a.dateNaissance);
          return age !== null && age < 1;
        },
      },
      {
        key: "adult",
        label: "Adultes (≥ 2 ans)",
        predicate: (a) => {
          const age = ageAns(a.dateNaissance);
          return age !== null && age >= 2;
        },
      },
      { key: "bovin", label: "Bovins uniquement", predicate: (a) => isBovin(a.categorie) },
      { key: "bvd-frei", label: "BVD-frei", predicate: (a) => a.statutBvd === "frei" },
      {
        key: "bvd-suspect",
        label: "BVD à surveiller (suspect/positif)",
        predicate: (a) => a.statutBvd === "suspect" || a.statutBvd === "positif",
      },
      { key: "bio", label: "Label Bio", predicate: (a) => a.secteurLabel === "bio" },
    ],
    [],
  );

  const groupBys = useMemo<GroupByOption<Animal>[]>(
    () => [
      {
        key: "categorie",
        label: "Catégorie",
        groupKey: (a) => a.categorie,
        groupLabel: (k) =>
          `${emojiCategorie(k as AnimalCategorie)} ${libelleCategorie(k as AnimalCategorie)}`,
        order: CATEGORIES_ORDER as string[],
      },
      {
        key: "famille",
        label: "Famille (bovins / ovins / …)",
        groupKey: (a) => FAMILLE_BY_CATEGORIE[a.categorie],
        groupLabel: (k) => k,
        order: FAMILLE_ORDER as string[],
      },
      {
        key: "usage",
        label: "Usage",
        groupKey: (a) => a.usage ?? "non-spécifié",
        groupLabel: (k) => (k === "non-spécifié" ? "Non spécifié" : libelleUsage(k)),
      },
      {
        key: "secteur-label",
        label: "Secteur / Label",
        groupKey: (a) => a.secteurLabel ?? "non-spécifié",
        groupLabel: (k) => (k === "non-spécifié" ? "Non spécifié" : libelleLabel(k)),
      },
      {
        key: "bvd",
        label: "Statut BVD",
        groupKey: (a) => a.statutBvd ?? "non-spécifié",
        groupLabel: (k) => (k === "non-spécifié" ? "BVD non renseigné" : (bvdBadge(k)?.label ?? k)),
      },
      {
        key: "identification",
        label: "État d'identification",
        groupKey: (a) => (a.numeroBoucle ? "Identifiés" : "À identifier"),
        groupLabel: (k) => k,
        order: ["Identifiés", "À identifier"],
      },
      {
        key: "vivant-mort",
        label: "Vivant / Mort",
        groupKey: (a) => (a.dateMort ? "Morts" : "Vivants"),
        groupLabel: (k) => k,
        order: ["Vivants", "Morts"],
      },
    ],
    [],
  );

  const columns = useMemo<ListColumn<Animal>[]>(
    () => [
      {
        key: "categorie",
        header: "Catégorie",
        cell: (a) => (
          <span className="flex items-center gap-1.5">
            <span aria-hidden>{emojiCategorie(a.categorie)}</span>
            <span className="truncate">{libelleCategorie(a.categorie)}</span>
          </span>
        ),
      },
      {
        key: "boucle",
        header: "N° boucle",
        cell: (a) =>
          a.numeroBoucle ? (
            <code className="font-mono text-xs">{a.numeroBoucle}</code>
          ) : (
            <span className="text-foreground/30">—</span>
          ),
      },
      {
        key: "nom",
        header: "Nom",
        cell: (a) => a.nom ?? <span className="text-foreground/30">—</span>,
      },
      {
        key: "naissance",
        header: "Date de naissance",
        cell: (a) => (
          <span className="whitespace-nowrap text-xs">{formatDateNaissance(a.dateNaissance)}</span>
        ),
        hideBelow: "md",
      },
      {
        key: "usage",
        header: "Usage",
        cell: (a) =>
          a.usage ? (
            <span className="text-xs">{libelleUsage(a.usage)}</span>
          ) : (
            <span className="text-foreground/30">—</span>
          ),
        hideBelow: "lg",
      },
      {
        key: "label",
        header: "Label",
        cell: (a) =>
          a.secteurLabel ? (
            <span className="text-xs">{libelleLabel(a.secteurLabel)}</span>
          ) : (
            <span className="text-foreground/30">—</span>
          ),
        hideBelow: "lg",
      },
      {
        key: "bvd",
        header: "BVD",
        cell: (a) => {
          const b = bvdBadge(a.statutBvd);
          if (!b) return <span className="text-foreground/30">—</span>;
          return (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${b.color}`}>{b.label}</span>
          );
        },
        hideBelow: "md",
      },
      {
        key: "statut",
        header: "Statut",
        cell: (a) => {
          if (a.dateMort) {
            return (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Mort
              </span>
            );
          }
          return a.isActive ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Actif
            </span>
          ) : (
            <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
              Inactif
            </span>
          );
        },
        hideBelow: "sm",
      },
    ],
    [],
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Cheptel" }]} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Beef className="h-7 w-7 text-green" />
              Cheptel
            </h1>
            <p className="mt-1 text-foreground/70">
              {animauxQuery.isLoading
                ? "Chargement…"
                : `${animaux.length} animau${animaux.length > 1 ? "x" : "l"} dans le cheptel`}
              {ugb.data && animaux.length > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatUgb(ugb.data.total)} UGB
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              UGB calculé selon Annexe 1 OPD (référentiel officiel CH).
            </p>
          </div>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            Importer depuis BDTA
          </Button>
        </div>
        <ImportBdtaDialog open={importOpen} onClose={() => setImportOpen(false)} />

        {animauxQuery.isError && (
          <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le cheptel.
          </div>
        )}

        <ResourceView<Animal>
          storageKey="animaux"
          defaultView="kanban"
          data={animaux}
          columns={columns}
          renderKanbanCard={(a) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  <span aria-hidden className="text-base">
                    {emojiCategorie(a.categorie)}
                  </span>
                  <span className="truncate font-medium">
                    {a.nom ?? libelleCategorie(a.categorie)}
                  </span>
                </span>
                {a.isActive ? (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500"
                    title="Actif"
                  />
                ) : (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full bg-foreground/20"
                    title="Inactif"
                  />
                )}
              </div>
              {a.numeroBoucle && (
                <code className="mt-1 block truncate font-mono text-xs text-foreground/60">
                  {a.numeroBoucle}
                </code>
              )}
              <p className="mt-1 text-xs text-foreground/50">
                {formatDateNaissance(a.dateNaissance)}
              </p>
            </div>
          )}
          getKey={(a) => a.id}
          searchFields={(a) =>
            [
              a.nom ?? "",
              a.numeroBoucle ?? "",
              libelleCategorie(a.categorie),
              FAMILLE_BY_CATEGORIE[a.categorie],
              a.usage ?? "",
              a.secteurLabel ?? "",
              a.statutBvd ?? "",
            ].join(" ")
          }
          searchPlaceholder="Rechercher par nom, n° boucle, catégorie, usage, label…"
          filters={filters}
          groupBys={groupBys}
          onItemClick={(a) => router.push(`/animaux/${a.id}` as never)}
          emptyState={
            <div>
              <p className="mb-3 text-sm text-foreground/60">
                Aucun animal dans le cheptel. Importe depuis BDTA pour commencer.
              </p>
              <Button onClick={() => setImportOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                Importer depuis BDTA
              </Button>
            </div>
          }
        />

        <p className="mt-6 text-xs text-foreground/40">
          Pour modifier rapidement la composition par catégorie sans saisir chaque animal, utilise
          la{" "}
          <Link href="/srpa" className="underline">
            vue SRPA
          </Link>
          .
        </p>
      </div>
    </>
  );
}
