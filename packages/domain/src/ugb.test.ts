import { describe, expect, it } from "vitest";
import {
  type AnimalCategorie,
  type AnimalUgbInput,
  calculerUgbExploitation,
  coefUgb,
  DEFAULT_UGB_COEFFICIENTS,
} from "./ugb";

const REF = new Date("2026-04-29T12:00:00Z");

const naissance = (yearsAgo: number, daysAgo = 0): Date => {
  const d = new Date(REF);
  d.setUTCFullYear(d.getUTCFullYear() - yearsAgo);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
};

describe("coefUgb — sans date de naissance", () => {
  it.each(Object.entries(DEFAULT_UGB_COEFFICIENTS))(
    "%s → coefficient OPD par défaut %s",
    (cat, coef) => {
      expect(coefUgb(cat as AnimalCategorie)).toBe(coef);
    },
  );

  it("date null → coefficient par défaut", () => {
    expect(coefUgb("GENISSE", null)).toBe(0.6);
  });

  it("date invalide → coefficient par défaut", () => {
    expect(coefUgb("GENISSE", "pas-une-date")).toBe(0.6);
  });
});

describe("coefUgb — affinement par âge", () => {
  it("génisse > 2 ans → 0.70", () => {
    expect(coefUgb("GENISSE", naissance(3), REF)).toBe(0.7);
  });
  it("génisse 1-2 ans → 0.40", () => {
    expect(coefUgb("GENISSE", naissance(1, 200), REF)).toBe(0.4);
  });
  it("génisse < 1 an → 0.30", () => {
    expect(coefUgb("GENISSE", naissance(0, 200), REF)).toBe(0.3);
  });

  it("veau < 160 jours → 0.13", () => {
    expect(coefUgb("VEAU", naissance(0, 100), REF)).toBe(0.13);
  });
  it("veau >= 160 jours → 0.30", () => {
    expect(coefUgb("VEAU", naissance(0, 200), REF)).toBe(0.3);
  });

  it("bœuf < 1 an → 0.30", () => {
    expect(coefUgb("BOEUF", naissance(0, 200), REF)).toBe(0.3);
  });
  it("bœuf > 1 an → 0.60", () => {
    expect(coefUgb("BOEUF", naissance(2), REF)).toBe(0.6);
  });

  it("autre bovin > 1 an → 0.60", () => {
    expect(coefUgb("AUTRE_BOVIN", naissance(3), REF)).toBe(0.6);
  });
  it("autre bovin < 1 an → 0.30", () => {
    expect(coefUgb("AUTRE_BOVIN", naissance(0, 100), REF)).toBe(0.3);
  });

  it("date dans le futur → âge 0 → coef veau/jeune", () => {
    const futur = new Date(REF);
    futur.setUTCFullYear(futur.getUTCFullYear() + 1);
    expect(coefUgb("GENISSE", futur, REF)).toBe(0.3);
  });

  it("vache laitière : pas d'affinement, toujours 1.0", () => {
    expect(coefUgb("VACHE_LAITIERE", naissance(5), REF)).toBe(1.0);
    expect(coefUgb("VACHE_LAITIERE", naissance(10), REF)).toBe(1.0);
  });
});

describe("calculerUgbExploitation", () => {
  it("exploitation vide → total 0, aucune catégorie", () => {
    expect(calculerUgbExploitation([], REF)).toEqual({ total: 0, parCategorie: [] });
  });

  it("compteur anonyme : 25 vaches laitières → 25 UGB", () => {
    const animaux: AnimalUgbInput[] = Array.from({ length: 25 }, () => ({
      categorie: "VACHE_LAITIERE",
    }));
    const result = calculerUgbExploitation(animaux, REF);
    expect(result.total).toBe(25);
    expect(result.parCategorie).toEqual([
      { categorie: "VACHE_LAITIERE", nombreAnimaux: 25, coefMoyen: 1, ugbTotal: 25 },
    ]);
  });

  it("mélange anonyme + identifié : coef moyen pondéré", () => {
    const animaux: AnimalUgbInput[] = [
      { categorie: "GENISSE" }, // 0.6
      { categorie: "GENISSE", dateNaissance: naissance(3) }, // 0.7 (> 2 ans)
      { categorie: "GENISSE", dateNaissance: naissance(0, 100) }, // 0.3 (< 1 an)
    ];
    const result = calculerUgbExploitation(animaux, REF);
    // (0.6 + 0.7 + 0.3) = 1.6 → 1.6 / 3 = 0.533
    expect(result.parCategorie[0]).toMatchObject({
      categorie: "GENISSE",
      nombreAnimaux: 3,
      ugbTotal: 1.6,
    });
    expect(result.parCategorie[0].coefMoyen).toBeCloseTo(0.533, 3);
    expect(result.total).toBe(1.6);
  });

  it("exploitation type : 25 VL + 8 génisses + 5 veaux + 50 porcs = 36.05 UGB", () => {
    const animaux: AnimalUgbInput[] = [
      ...Array.from({ length: 25 }, (): AnimalUgbInput => ({ categorie: "VACHE_LAITIERE" })),
      ...Array.from({ length: 8 }, (): AnimalUgbInput => ({ categorie: "GENISSE" })),
      ...Array.from({ length: 5 }, (): AnimalUgbInput => ({ categorie: "VEAU" })),
      ...Array.from({ length: 50 }, (): AnimalUgbInput => ({ categorie: "PORC" })),
    ];
    // 25 × 1.0 + 8 × 0.6 + 5 × 0.13 + 50 × 0.13 = 25 + 4.8 + 0.65 + 6.5 = 36.95
    const result = calculerUgbExploitation(animaux, REF);
    expect(result.total).toBe(36.95);
    expect(result.parCategorie).toHaveLength(4);
    expect(result.parCategorie[0].categorie).toBe("VACHE_LAITIERE"); // tri par UGB desc
  });

  it("catégorie AUTRE → coef 0, n'apparaît pas avec 0 animaux", () => {
    const result = calculerUgbExploitation([{ categorie: "AUTRE" }, { categorie: "AUTRE" }], REF);
    expect(result.total).toBe(0);
    expect(result.parCategorie).toEqual([
      { categorie: "AUTRE", nombreAnimaux: 2, coefMoyen: 0, ugbTotal: 0 },
    ]);
  });

  it("résultat trié par UGB total décroissant", () => {
    const animaux: AnimalUgbInput[] = [
      ...Array.from({ length: 100 }, (): AnimalUgbInput => ({ categorie: "POULET" })),
      ...Array.from({ length: 5 }, (): AnimalUgbInput => ({ categorie: "VACHE_LAITIERE" })),
    ];
    const result = calculerUgbExploitation(animaux, REF);
    // 5 VL = 5 UGB, 100 poulets = 0.4 UGB → VL en premier
    expect(result.parCategorie.map((p) => p.categorie)).toEqual(["VACHE_LAITIERE", "POULET"]);
  });
});
