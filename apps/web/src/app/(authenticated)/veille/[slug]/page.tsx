"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { Markdown } from "@/lib/markdown";
import { CATEGORIE_COLOR, CATEGORIE_LIBELLE, useVeilleArticle } from "@/lib/veille";

export default function VeilleArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const article = useVeilleArticle(slug);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/app" },
          { label: "Veille réglementaire", href: "/veille" },
          { label: article.data?.titre ?? "…" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/veille"
          className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Link>

        {article.isLoading && <p className="text-sm text-foreground/60">Chargement…</p>}

        {article.isError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Article introuvable.
          </p>
        )}

        {article.data && (
          <article>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORIE_COLOR[article.data.categorie]}`}
              >
                {CATEGORIE_LIBELLE[article.data.categorie]}
              </span>
              <span className="text-xs text-foreground/50">
                Mise à jour {new Date(article.data.dateMaj).toLocaleDateString("fr-CH")}
              </span>
            </div>

            <h1 className="text-3xl font-bold">{article.data.titre}</h1>
            <p className="mt-3 text-lg text-foreground/70">{article.data.resume}</p>

            {article.data.sourceUrl && (
              <a
                href={article.data.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-green underline hover:no-underline"
              >
                <ExternalLink className="h-4 w-4" />
                {article.data.sourceNom ?? "Source officielle"}
              </a>
            )}

            <div className="mt-6 border-t border-border pt-6 text-base">
              <Markdown source={article.data.contenu} />
            </div>

            {article.data.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-4">
                {article.data.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </>
  );
}
