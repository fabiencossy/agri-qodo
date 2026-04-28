import { describe, expect, it } from "vitest";
import { type CultureRecord, verifierAssolement } from "./assolement";

const make = (parcelleId: string, espece: string, campagne: number): CultureRecord => ({
  parcelleId,
  espece,
  campagne,
});

describe("verifierAssolement", () => {
  it("rotation correcte sur 5 ans → ok", () => {
    const cultures: CultureRecord[] = [
      make("p1", "ble_panifiable", 2022),
      make("p1", "colza", 2023),
      make("p1", "mais_grain", 2024),
      make("p1", "ble_panifiable", 2025),
      make("p1", "tournesol", 2026),
    ];
    const result = verifierAssolement(cultures);
    expect(result.ok).toBe(true);
    expect(result.incidents).toHaveLength(0);
  });

  it("monoculture 2 ans consécutifs → incident monoculture_consecutive", () => {
    const cultures: CultureRecord[] = [
      make("p1", "ble_panifiable", 2025),
      make("p1", "ble_panifiable", 2026),
      make("p1", "colza", 2027),
      make("p2", "mais_grain", 2026),
      make("p2", "tournesol", 2027),
    ];
    const result = verifierAssolement(cultures);
    expect(result.ok).toBe(false);
    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0]).toEqual({
      type: "monoculture_consecutive",
      parcelleId: "p1",
      espece: "ble_panifiable",
      campagnes: [2025, 2026],
    });
  });

  it("prairies multi-annuelles autorisées (exception)", () => {
    const cultures: CultureRecord[] = [
      make("p1", "prairie_temporaire", 2024),
      make("p1", "prairie_temporaire", 2025),
      make("p1", "prairie_temporaire", 2026),
      make("p2", "ble_panifiable", 2025),
      make("p2", "colza", 2026),
      make("p3", "mais_grain", 2026),
      make("p4", "tournesol", 2026),
    ];
    const result = verifierAssolement(cultures);
    expect(result.ok).toBe(true);
  });

  it("diversité insuffisante → incident diversite_insuffisante", () => {
    // Seulement 3 espèces sur les 5 dernières campagnes.
    const cultures: CultureRecord[] = [
      make("p1", "ble_panifiable", 2022),
      make("p2", "colza", 2023),
      make("p3", "mais_grain", 2024),
      make("p1", "ble_panifiable", 2025),
      make("p2", "colza", 2026),
    ];
    const result = verifierAssolement(cultures);
    expect(result.ok).toBe(false);
    const incident = result.incidents.find((i) => i.type === "diversite_insuffisante");
    expect(incident).toBeDefined();
    if (incident && incident.type === "diversite_insuffisante") {
      expect(incident.especesUniques).toHaveLength(3);
      expect(incident.minimumRequis).toBe(4);
    }
  });

  it("trou d'une année (rotation pas consécutive) → pas d'incident", () => {
    // Blé en 2024 puis blé en 2026 (2025 absent) — pas un cas de monoculture
    // au sens de la règle : il n'y a pas d'année 2025 sur la parcelle, donc
    // pas de consécutif détecté.
    const cultures: CultureRecord[] = [
      make("p1", "ble_panifiable", 2024),
      make("p1", "ble_panifiable", 2026),
      make("p2", "colza", 2025),
      make("p3", "mais_grain", 2026),
      make("p4", "tournesol", 2026),
    ];
    const result = verifierAssolement(cultures);
    expect(result.ok).toBe(true);
  });

  it("plusieurs incidents simultanés sont tous remontés", () => {
    const cultures: CultureRecord[] = [
      // monoculture sur p1
      make("p1", "ble_panifiable", 2025),
      make("p1", "ble_panifiable", 2026),
      // monoculture sur p2
      make("p2", "mais_grain", 2025),
      make("p2", "mais_grain", 2026),
    ];
    const result = verifierAssolement(cultures);
    expect(result.ok).toBe(false);
    const monocultures = result.incidents.filter((i) => i.type === "monoculture_consecutive");
    expect(monocultures).toHaveLength(2);
    // Et la diversité est aussi insuffisante (2 espèces seulement).
    const diversite = result.incidents.find((i) => i.type === "diversite_insuffisante");
    expect(diversite).toBeDefined();
  });

  it("liste vide → ok (aucun incident possible)", () => {
    const result = verifierAssolement([]);
    expect(result.ok).toBe(true);
    expect(result.incidents).toHaveLength(0);
  });
});
