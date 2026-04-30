"use client";

import { BookOpen, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Input } from "@/components/ui/input";
import {
  CATEGORIE_COLOR,
  CATEGORIE_LIBELLE,
  type VeilleCategorie,
  useVeilleArticles,
} from "@/lib/veille";

const CATEGORIES: VeilleCategorie[] = ["OPD", "OPPh", "Calendrier", "Lex", "Guide", "Glossaire"];

export default function VeillePage() {
  const [categorie, setCategorie] = useState<VeilleCategorie | undefined>(undefined);
  const [query, setQuery] = useState("");
  const filters: { categorie?: VeilleCategorie; q?: string } = {};
  if (categorie) filters.categorie = categorie;
  if (query.trim()) filters.q = query.trim();
  const articles = useVeilleArticles(filters);

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/app" }, { label: "Veille réglementaire" }]} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <BookOpen className="h-7 w-7 text-green" />
            Veille réglementaire
          </h1>
          <p className="mt-1 text-foreground/70">
            Bibliothèque OPD, OPPh, guides Agridea, glossaire métier et calendrier réglementaire.
            Tous les articles sont rédigés en français paysan, avec lien vers la source officielle.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (PER, lisier, UGB, BDTA…)"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <CategoryChip
            active={categorie === undefined}
            onClick={() => setCategorie(undefined)}
            label="Toutes"
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              active={categorie === c}
              onClick={() => setCategorie(c)}
              label={CATEGORIE_LIBELLE[c]}
              color={CATEGORIE_COLOR[c]}
            />
          ))}
        </div>

        {articles.isLoading && <p className="text-sm text-foreground/60">Chargement…</p>}
        {articles.isError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Impossible de charger les articles.
          </p>
        )}
        {articles.data && articles.data.length === 0 && (
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-foreground/60">
            Aucun article ne correspond à ta recherche.
          </p>
        )}
        {articles.data && articles.data.length > 0 && (
          <ul className="space-y-3">
            {articles.data.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/veille/${a.slug}` as never}
                  className="block rounded-2xl border border-border bg-background p-4 transition-colors hover:border-green/50"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORIE_COLOR[a.categorie]}`}
                    >
                      {CATEGORIE_LIBELLE[a.categorie]}
                    </span>
                    <span className="text-xs text-foreground/50">
                      Maj {new Date(a.dateMaj).toLocaleDateString("fr-CH")}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold">{a.titre}</h2>
                  <p className="mt-1 text-sm text-foreground/70">{a.resume}</p>
                  {a.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  const base = "rounded-full px-3 py-1 text-sm transition-colors border";
  if (active) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${color ?? "bg-green/10 text-green"} border-current`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border-border text-foreground/70 hover:bg-muted`}
    >
      {label}
    </button>
  );
}
