import { describe, expect, it } from "vitest";
import { type BilanInput, calculerBilan, DEFAULT_SUISSE_BILANZ_CONFIG } from "./suisse-bilanz";

describe("calculerBilan", () => {
  it("ferme conforme : besoins compensés par apports modérés", () => {
    // 10 ha de blé panifiable → 10 × 140 = 1400 kg N besoin
    // 5 vaches laitières (5 UGB) → 5 × 105 = 525 kg N apport
    // 100 kg engrais minéral 30% N (= 30 kg N) → 30 kg N apport
    // Total apports = 555, besoins = 1400 → solde = -845 (très conforme)
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "Champ 1",
          surfaceHa: 10,
          espece: "ble_panifiable",
        },
      ],
      animaux: [{ categorie: "VACHE_LAITIERE", nombre: 5 }],
      apportsEngrais: [{ parcelleId: "p1", kgN: 30, kgP: 10 }],
    };
    const r = calculerBilan(input);
    expect(r.besoinsN).toBe(1400);
    expect(r.apportsN).toBe(555);
    expect(r.soldeN).toBe(-845);
    expect(r.conformeN).toBe(true);
  });

  it("ferme non conforme : surfertilisation azote", () => {
    // 1 ha prairie permanente → 110 kg N besoin
    // 100 vaches laitières → 100 × 105 = 10500 kg N (énorme apport)
    // → solde = 10500 - 110 = 10390, dépasse largement 11 (10% de 110)
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "Pré",
          surfaceHa: 1,
          espece: "prairie_permanente",
        },
      ],
      animaux: [{ categorie: "VACHE_LAITIERE", nombre: 100 }],
      apportsEngrais: [],
    };
    const r = calculerBilan(input);
    expect(r.conformeN).toBe(false);
    expect(r.soldeN).toBeGreaterThan(0);
  });

  it("culture inconnue est tracée dans culturesInconnues", () => {
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "X",
          surfaceHa: 5,
          espece: "espece_exotique_inconnue",
        },
      ],
      animaux: [],
      apportsEngrais: [],
    };
    const r = calculerBilan(input);
    expect(r.culturesInconnues).toEqual(["espece_exotique_inconnue"]);
    expect(r.besoinsN).toBe(0);
  });

  it("calcul P séparé du calcul N", () => {
    // 5 ha colza : besoin P = 5 × 35 = 175 kg P
    // 10 porcs (10 × 0.15 = 1.5 UGB) : 1.5 × 30 = 45 kg P
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "C",
          surfaceHa: 5,
          espece: "colza",
        },
      ],
      animaux: [{ categorie: "PORC", nombre: 10 }],
      apportsEngrais: [],
    };
    const r = calculerBilan(input);
    expect(r.besoinsP).toBe(175);
    expect(r.apportsP).toBe(45);
    expect(r.soldeP).toBe(-130);
    expect(r.conformeP).toBe(true);
  });

  it("tolérance configurable : à 0% une ferme borderline devient non-conforme", () => {
    // Besoin = 100, apport = 105 → solde = +5, tolérance par défaut 10% → seuil 10 → conforme
    // Si tolérance 0% → seuil 0 → non-conforme
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "T",
          surfaceHa: 1,
          espece: "ble_panifiable", // 140 N/ha
        },
      ],
      animaux: [],
      apportsEngrais: [{ parcelleId: "p1", kgN: 145, kgP: 35 }], // 145 = 140 + 5 (5 au-dessus)
    };
    expect(calculerBilan(input).conformeN).toBe(true); // 5 ≤ 14 (10% de 140)
    const strict = calculerBilan(input, {
      ...DEFAULT_SUISSE_BILANZ_CONFIG,
      tolerance: 0,
    });
    expect(strict.conformeN).toBe(false); // 5 > 0
  });

  it("plusieurs parcelles agrégées correctement", () => {
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "A",
          surfaceHa: 5,
          espece: "ble_panifiable",
        },
        {
          parcelleId: "p2",
          parcelleNom: "B",
          surfaceHa: 3,
          espece: "colza",
        },
        {
          parcelleId: "p3",
          parcelleNom: "C",
          surfaceHa: 10,
          espece: "prairie_temporaire",
        },
      ],
      animaux: [],
      apportsEngrais: [],
    };
    const r = calculerBilan(input);
    // 5×140 + 3×130 + 10×130 = 700 + 390 + 1300 = 2390
    expect(r.besoinsN).toBe(2390);
    expect(r.details).toHaveLength(3);
    const detailB = r.details.find((d) => d.parcelleId === "p2");
    expect(detailB?.besoinN).toBe(390); // 3 ha × 130
  });

  it("input vide → bilan zéro et conforme", () => {
    const r = calculerBilan({
      cultures: [],
      animaux: [],
      apportsEngrais: [],
    });
    expect(r.apportsN).toBe(0);
    expect(r.besoinsN).toBe(0);
    expect(r.soldeN).toBe(0);
    expect(r.conformeN).toBe(true);
  });

  it("config personnalisée override les coefficients", () => {
    const customConfig = {
      ...DEFAULT_SUISSE_BILANZ_CONFIG,
      besoinNParCulture: { ble_panifiable: 200 }, // surcharge
    };
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "X",
          surfaceHa: 1,
          espece: "ble_panifiable",
        },
      ],
      animaux: [],
      apportsEngrais: [],
    };
    expect(calculerBilan(input, customConfig).besoinsN).toBe(200);
    expect(calculerBilan(input).besoinsN).toBe(140); // default
  });
});
