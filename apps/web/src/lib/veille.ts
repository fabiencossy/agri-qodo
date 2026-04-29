"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export type VeilleCategorie = "OPD" | "OPPh" | "Lex" | "Guide" | "Glossaire" | "Calendrier";

export interface VeilleArticleSummary {
  slug: string;
  titre: string;
  categorie: VeilleCategorie;
  resume: string;
  sourceUrl?: string;
  sourceNom?: string;
  dateMaj: string;
  tags: string[];
}

export interface VeilleArticle extends VeilleArticleSummary {
  contenu: string;
}

export const CATEGORIE_LIBELLE: Record<VeilleCategorie, string> = {
  OPD: "Paiements directs",
  OPPh: "Phytosanitaires",
  Lex: "Autres lois",
  Guide: "Guides Agridea",
  Glossaire: "Glossaire",
  Calendrier: "Calendrier",
};

export const CATEGORIE_COLOR: Record<VeilleCategorie, string> = {
  OPD: "bg-green/10 text-green",
  OPPh: "bg-amber-100 text-amber-800",
  Lex: "bg-blue-100 text-blue-800",
  Guide: "bg-purple-100 text-purple-800",
  Glossaire: "bg-slate-100 text-slate-700",
  Calendrier: "bg-rose-100 text-rose-800",
};

export interface VeilleListFilters {
  categorie?: VeilleCategorie;
  q?: string;
}

export function useVeilleArticles(filters: VeilleListFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.categorie) qs.set("categorie", filters.categorie);
  if (filters.q) qs.set("q", filters.q);
  const url = qs.toString() ? `/api/veille?${qs.toString()}` : "/api/veille";
  return useQuery({
    queryKey: ["veille", "list", filters] as const,
    queryFn: () => api<VeilleArticleSummary[]>(url),
  });
}

export function useVeilleArticle(slug: string) {
  return useQuery({
    queryKey: ["veille", "article", slug] as const,
    queryFn: () => api<VeilleArticle>(`/api/veille/${slug}`),
    enabled: slug.length > 0,
  });
}
