import { describe, expect, it } from "vitest";
import { getVeilleArticle, listVeilleCategories, searchVeille, VEILLE_ARTICLES } from "./veille";

describe("VEILLE_ARTICLES seed", () => {
  it("au moins 5 articles", () => {
    expect(VEILLE_ARTICLES.length).toBeGreaterThanOrEqual(5);
  });

  it("slugs uniques", () => {
    const slugs = new Set(VEILLE_ARTICLES.map((a) => a.slug));
    expect(slugs.size).toBe(VEILLE_ARTICLES.length);
  });

  it("dateMaj au format ISO", () => {
    for (const a of VEILLE_ARTICLES) {
      expect(a.dateMaj).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("contenu et résumé non vides", () => {
    for (const a of VEILLE_ARTICLES) {
      expect(a.titre.length).toBeGreaterThan(0);
      expect(a.resume.length).toBeGreaterThan(20);
      expect(a.contenu.length).toBeGreaterThan(50);
    }
  });
});

describe("searchVeille", () => {
  it("sans options → tous les articles", () => {
    expect(searchVeille()).toHaveLength(VEILLE_ARTICLES.length);
  });

  it("filtre par catégorie", () => {
    const opd = searchVeille(VEILLE_ARTICLES, { categorie: "OPD" });
    expect(opd.length).toBeGreaterThan(0);
    expect(opd.every((a) => a.categorie === "OPD")).toBe(true);
  });

  it("query matche titre", () => {
    const r = searchVeille(VEILLE_ARTICLES, { query: "calendrier" });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].titre.toLowerCase()).toContain("calendrier");
  });

  it("query matche tag", () => {
    const r = searchVeille(VEILLE_ARTICLES, { query: "lisier" });
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it("query matche contenu", () => {
    const r = searchVeille(VEILLE_ARTICLES, { query: "Identitas" });
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it("query insensible à la casse + accents", () => {
    expect(searchVeille(VEILLE_ARTICLES, { query: "PHYTO" }).length).toBeGreaterThan(0);
  });

  it("query qui ne matche rien → tableau vide", () => {
    expect(searchVeille(VEILLE_ARTICLES, { query: "XYZ_QUI_EXISTE_PAS_123" })).toEqual([]);
  });

  it("catégorie + query combinés", () => {
    const r = searchVeille(VEILLE_ARTICLES, { categorie: "Glossaire", query: "UGB" });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].categorie).toBe("Glossaire");
  });
});

describe("getVeilleArticle", () => {
  it("slug existant → article", () => {
    const a = getVeilleArticle("opd-2026-vue-densemble");
    expect(a).toBeDefined();
    expect(a?.titre).toContain("OPD");
  });

  it("slug inconnu → undefined", () => {
    expect(getVeilleArticle("inexistant")).toBeUndefined();
  });
});

describe("listVeilleCategories", () => {
  it("retourne les catégories présentes avec leur compte", () => {
    const cats = listVeilleCategories();
    expect(cats.length).toBeGreaterThan(0);
    const total = cats.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(VEILLE_ARTICLES.length);
  });
});
