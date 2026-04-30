"use client";

/**
 * Liste détaillée du cheptel — `/animaux/liste`.
 *
 * Affiche TOUS les animaux individuellement (un par ligne / une carte),
 * vs la page parente `/animaux` qui agrège par catégorie. Utilise le
 * composant générique <ResourceView> pour fournir :
 * - Bascule liste / kanban
 * - Search bar + panneau Filtres / Regrouper / Favoris (style Odoo)
 * - Persistance des préférences en localStorage par utilisateur.
 */
import { Beef } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import {
  type FilterOption,
  type GroupByOption,
  type ListColumn,
  ResourceView,
} from "@/components/ui/resource-view";
import {
  type Animal,
  type AnimalFamille,
  FAMILLE_BY_CATEGORIE,
  isBovin,
  useAnimaux,
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

export default function CheptelListePage() {
  const animauxQuery = useAnimaux();
  const animaux = useMemo(() => animauxQuery.data ?? [], [animauxQuery.data]);

  const filters = useMemo<FilterOption<Animal>[]>(
    () => [
      { key: "identified", label: "Identifiés (n° boucle)", predicate: (a) => !!a.numeroBoucle },
      { key: "non-identified", label: "Sans identification", predicate: (a) => !a.numeroBoucle },
      { key: "with-name", label: "Avec un nom", predicate: (a) => !!a.nom },
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
        key: "identification",
        label: "État d'identification",
        groupKey: (a) => (a.numeroBoucle ? "Identifiés" : "À identifier"),
        groupLabel: (k) => k,
        order: ["Identifiés", "À identifier"],
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
        key: "statut",
        header: "Statut",
        cell: (a) =>
          a.isActive ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Actif
            </span>
          ) : (
            <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
              Inactif
            </span>
          ),
        hideBelow: "sm",
      },
    ],
    [],
  );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Cheptel", href: "/animaux" },
          { label: "Liste détaillée" },
        ]}
      />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Beef className="h-7 w-7 text-green" />
              Liste détaillée du cheptel
            </h1>
            <p className="mt-1 text-foreground/70">
              {animauxQuery.isLoading
                ? "Chargement…"
                : `${animaux.length} animaux — recherche, filtres, regroupements et vues bascule comme dans Odoo.`}
            </p>
          </div>
          <Link href="/animaux" className="text-sm font-medium text-green hover:underline">
            ← Vue compteurs
          </Link>
        </div>

        {animauxQuery.isError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger le cheptel.
          </p>
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
            ].join(" ")
          }
          searchPlaceholder="Rechercher par nom, n° boucle, catégorie…"
          filters={filters}
          groupBys={groupBys}
          emptyState={
            <p className="text-sm text-foreground/60">
              Pas encore d'animal — utilise{" "}
              <Link href="/animaux" className="underline">
                la vue compteurs
              </Link>{" "}
              ou l'import BDTA pour en ajouter.
            </p>
          }
        />
      </div>
    </>
  );
}
