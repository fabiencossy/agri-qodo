import { describe, expect, it } from "vitest";
import { type BilanInput, calculerBilan, DEFAULT_SUISSE_BILANZ_CONFIG } from "./suisse-bilanz";

describe("calculerBilan", () => {
  it("ferme conforme : besoins compensés par apports modérés", () => {
    // 10 ha de blé panifiable → 10 × 140 = 1400 kg N besoin
    // 5 vaches laitières (5 UGB) → 5 × 105 = 525 kg N (déjections)
    // 100 kg engrais minéral 30% N (= 30 kg N) → 30 kg N
    // 10 ha × 20 kg N/ha (atmosphérique) → 200 kg N
    // Total apports = 525 + 30 + 200 = 755, besoins = 1400 → solde = -645
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
    expect(r.apportsN).toBe(755);
    expect(r.soldeN).toBe(-645);
    expect(r.conformeN).toBe(true);
    expect(r.origineApports.engraisMinerauxN).toBe(30);
    expect(r.origineApports.dejectionsCheptelN).toBe(525);
    expect(r.origineApports.atmospheriqueN).toBe(200);
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
    // 1 ha blé : besoin 140 N, atmo +20 N
    // engrais 130 N → apport total = 130 + 20 = 150
    // solde = 150 - 140 = +10
    // tol 10% → seuil 14 → 10 ≤ 14 → conforme
    // tol  0% → seuil  0 → 10 > 0 → non-conforme
    const input: BilanInput = {
      cultures: [
        {
          parcelleId: "p1",
          parcelleNom: "T",
          surfaceHa: 1,
          espece: "ble_panifiable",
        },
      ],
      animaux: [],
      apportsEngrais: [{ parcelleId: "p1", kgN: 130, kgP: 35 }],
    };
    expect(calculerBilan(input).conformeN).toBe(true);
    const strict = calculerBilan(input, {
      ...DEFAULT_SUISSE_BILANZ_CONFIG,
      tolerance: 0,
    });
    expect(strict.conformeN).toBe(false);
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

  it("apports localisés par parcelle dans le détail", () => {
    // 2 parcelles 1 ha chacune : p1 reçoit 50N+20P, p2 reçoit 30N
    // Atmosphérique : 20 N × 2 ha = 40 N total
    const input: BilanInput = {
      cultures: [
        { parcelleId: "p1", parcelleNom: "A", surfaceHa: 1, espece: "ble_panifiable" },
        { parcelleId: "p2", parcelleNom: "B", surfaceHa: 1, espece: "colza" },
      ],
      animaux: [],
      apportsEngrais: [
        { parcelleId: "p1", kgN: 50, kgP: 20 },
        { parcelleId: "p2", kgN: 30, kgP: 0 },
      ],
    };
    const r = calculerBilan(input);
    const a = r.details.find((d) => d.parcelleId === "p1");
    const b = r.details.find((d) => d.parcelleId === "p2");
    // Le détail par parcelle ne compte que les apports saisis (atmo est globale)
    expect(a?.apportsN).toBe(50);
    expect(a?.apportsP).toBe(20);
    expect(a?.soldeN).toBe(-90);
    expect(b?.apportsN).toBe(30);
    expect(b?.soldeN).toBe(-100);
    // Global : 80 (engrais) + 40 (atmo) = 120
    expect(r.apportsN).toBe(120);
  });

  it("apport sur parcelle sans culture compte au global mais pas au détail", () => {
    // p1 a une culture (1 ha), p2 n'en a pas mais reçoit un apport orphelin
    // Atmosphérique : 20 N × 1 ha = 20 N
    const input: BilanInput = {
      cultures: [{ parcelleId: "p1", parcelleNom: "A", surfaceHa: 1, espece: "ble_panifiable" }],
      animaux: [],
      apportsEngrais: [
        { parcelleId: "p1", kgN: 50, kgP: 20 },
        { parcelleId: "p_inconnue", kgN: 100, kgP: 50 },
      ],
    };
    const r = calculerBilan(input);
    expect(r.details).toHaveLength(1);
    expect(r.details[0]?.apportsN).toBe(50);
    // Global : 50 + 100 (engrais) + 20 (atmo) = 170
    expect(r.apportsN).toBe(170);
  });

  it("plusieurs apports sur la même parcelle s'agrègent dans le détail", () => {
    const input: BilanInput = {
      cultures: [{ parcelleId: "p1", parcelleNom: "A", surfaceHa: 1, espece: "ble_panifiable" }],
      animaux: [],
      apportsEngrais: [
        { parcelleId: "p1", kgN: 30, kgP: 10 },
        { parcelleId: "p1", kgN: 20, kgP: 5 },
      ],
    };
    const r = calculerBilan(input);
    expect(r.details[0]?.apportsN).toBe(50);
    expect(r.details[0]?.apportsP).toBe(15);
  });

  it("origine des apports : décomposition cheptel / engrais / atmo", () => {
    const input: BilanInput = {
      cultures: [{ parcelleId: "p1", parcelleNom: "A", surfaceHa: 5, espece: "ble_panifiable" }],
      animaux: [{ categorie: "VACHE_LAITIERE", nombre: 10 }],
      apportsEngrais: [
        { parcelleId: "p1", kgN: 50, kgP: 20, categorie: "ENGRAIS_MINERAL" },
        { parcelleId: "p1", kgN: 30, kgP: 10, categorie: "ENGRAIS_ORGANIQUE" },
      ],
    };
    const r = calculerBilan(input);
    expect(r.origineApports.engraisMinerauxN).toBe(50);
    expect(r.origineApports.engraisMinerauxP).toBe(20);
    expect(r.origineApports.engraisOrganiquesAchetesN).toBe(30);
    expect(r.origineApports.engraisOrganiquesAchetesP).toBe(10);
    expect(r.origineApports.dejectionsCheptelN).toBe(1050); // 10 × 1.0 × 105
    expect(r.origineApports.dejectionsCheptelP).toBe(180); // 10 × 1.0 × 18
    expect(r.origineApports.atmospheriqueN).toBe(100); // 20 × 5 ha
    expect(r.origineApports.fixationLegumineusesN).toBe(0);
    // apportsN total = 50 + 30 + 1050 + 100 = 1230
    expect(r.apportsN).toBe(1230);
  });

  it("fixation symbiotique légumineuses : annule besoin et compte en apport N", () => {
    // 5 ha de luzerne : config fixation = 250 kg N/ha → 1250 kg N total
    const input: BilanInput = {
      cultures: [{ parcelleId: "p1", parcelleNom: "L", surfaceHa: 5, espece: "luzerne" }],
      animaux: [],
      apportsEngrais: [],
    };
    const r = calculerBilan(input);
    expect(r.origineApports.fixationLegumineusesN).toBe(1250);
    // Atmo : 20 × 5 = 100
    expect(r.apportsN).toBe(1350);
  });

  it("apport ENGRAIS_ORGANIQUE par défaut (sans categorie) → catégorisé minéral", () => {
    // Backward-compat : si l'input ne précise pas categorie, on assume minéral
    const input: BilanInput = {
      cultures: [{ parcelleId: "p1", parcelleNom: "A", surfaceHa: 1, espece: "ble_panifiable" }],
      animaux: [],
      apportsEngrais: [{ parcelleId: "p1", kgN: 40, kgP: 10 }], // pas de categorie
    };
    const r = calculerBilan(input);
    expect(r.origineApports.engraisMinerauxN).toBe(40);
    expect(r.origineApports.engraisOrganiquesAchetesN).toBe(0);
  });
});
