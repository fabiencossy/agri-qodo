import { describe, expect, it } from "vitest";
import {
  detecterSeparateur,
  mapperCategorie,
  parseBdtaCsv,
  parseDateBdta,
  parseSexe,
} from "./bdta-import";

const REF = new Date("2026-04-29T12:00:00Z");

describe("detecterSeparateur", () => {
  it("Excel CH (;) → ';'", () => {
    expect(detecterSeparateur("a;b;c\n1;2;3")).toBe(";");
  });
  it("CSV anglo-saxon (,) → ','", () => {
    expect(detecterSeparateur("a,b,c\n1,2,3")).toBe(",");
  });
  it("ligne avec virgules dans guillemets reste ;-friendly", () => {
    expect(detecterSeparateur('a;b;c\n"1,5";2;3')).toBe(";");
  });
});

describe("parseDateBdta", () => {
  it("DD.MM.YYYY → Date UTC", () => {
    expect(parseDateBdta("15.03.2022")?.toISOString()).toBe("2022-03-15T00:00:00.000Z");
  });
  it("DD/MM/YYYY → Date UTC", () => {
    expect(parseDateBdta("15/03/2022")?.toISOString()).toBe("2022-03-15T00:00:00.000Z");
  });
  it("YYYY-MM-DD → Date UTC", () => {
    expect(parseDateBdta("2022-03-15")?.toISOString()).toBe("2022-03-15T00:00:00.000Z");
  });
  it("vide → null", () => {
    expect(parseDateBdta("")).toBeNull();
  });
  it("format invalide → null", () => {
    expect(parseDateBdta("not-a-date")).toBeNull();
  });
});

describe("parseSexe", () => {
  it.each([
    ["M", "M"],
    ["male", "M"],
    ["Männlich", "M"],
    ["F", "F"],
    ["femelle", "F"],
    ["Female", "F"],
    ["Weiblich", "F"],
  ])("%s → %s", (input, expected) => {
    expect(parseSexe(input)).toBe(expected);
  });
  it("vide → null", () => {
    expect(parseSexe("")).toBeNull();
  });
  it("inconnu → null", () => {
    expect(parseSexe("xyz")).toBeNull();
  });
});

describe("mapperCategorie", () => {
  const il_y_a = (ans: number, jours = 0): Date => {
    const d = new Date(REF);
    d.setUTCFullYear(d.getUTCFullYear() - ans);
    d.setUTCDate(d.getUTCDate() - jours);
    return d;
  };

  it("femelle > 2 ans → VACHE_LAITIERE", () => {
    expect(mapperCategorie("F", il_y_a(3), REF)).toBe("VACHE_LAITIERE");
  });
  it("femelle 1-2 ans → GENISSE", () => {
    expect(mapperCategorie("F", il_y_a(1, 100), REF)).toBe("GENISSE");
  });
  it("femelle < 1 an → VEAU", () => {
    expect(mapperCategorie("F", il_y_a(0, 100), REF)).toBe("VEAU");
  });
  it("mâle > 1 an → BOEUF (taureau ne se déduit pas du CSV)", () => {
    expect(mapperCategorie("M", il_y_a(3), REF)).toBe("BOEUF");
    expect(mapperCategorie("M", il_y_a(1, 100), REF)).toBe("BOEUF");
  });
  it("mâle < 1 an → VEAU", () => {
    expect(mapperCategorie("M", il_y_a(0, 200), REF)).toBe("VEAU");
  });
  it("sexe inconnu → AUTRE_BOVIN", () => {
    expect(mapperCategorie(null, il_y_a(3), REF)).toBe("AUTRE_BOVIN");
  });
  it("date inconnue → AUTRE_BOVIN", () => {
    expect(mapperCategorie("F", null, REF)).toBe("AUTRE_BOVIN");
  });
});

describe("parseBdtaCsv — formats Identitas", () => {
  it("Excel CH français — ; séparateur, dates DD.MM.YYYY", () => {
    const csv = [
      "Numéro de la marque auriculaire;Sexe;Date de naissance;Race",
      "CH 12.345.6789.0;F;15.03.2022;Holstein",
      "CH 12.345.6789.1;M;01.06.2025;Limousine",
      "CH 12.345.6789.2;F;10.10.2024;Brune",
    ].join("\n");
    const result = parseBdtaCsv(csv, { reference: REF });
    expect(result.separateur).toBe(";");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      numeroBoucle: "CH 12.345.6789.0",
      categorie: "VACHE_LAITIERE",
      race: "Holstein",
      ligne: 1,
    });
    expect(result.rows[1].categorie).toBe("VEAU");
    expect(result.rows[2].categorie).toBe("GENISSE");
  });

  it("Excel CH allemand — Ohrmarke / Geschlecht / Geburtsdatum", () => {
    const csv = [
      "Ohrmarke;Geschlecht;Geburtsdatum;Rasse",
      "CH 99.888.7777.0;Männlich;20.05.2020;Angus",
    ].join("\n");
    const result = parseBdtaCsv(csv, { reference: REF });
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      numeroBoucle: "CH 99.888.7777.0",
      categorie: "BOEUF",
      race: "Angus",
    });
  });

  it("CSV virgule + ISO date", () => {
    const csv = ["Ear tag,Sex,Birth date", "CH123456789012,F,2025-08-15"].join("\n");
    const result = parseBdtaCsv(csv, { reference: REF });
    expect(result.separateur).toBe(",");
    expect(result.rows[0].categorie).toBe("VEAU"); // < 1 an / REF 2026-04-29
  });

  it("ligne sans n° boucle → ignorée + erreur", () => {
    const csv = ["Marque;Sexe;Naissance", ";F;15.03.2022", "CH 11.111.1111.1;F;15.03.2022"].join(
      "\n",
    );
    const result = parseBdtaCsv(csv, { reference: REF });
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ ligne: 1, raison: "n° de boucle vide" });
  });

  it("CSV vide → résultat vide, pas d'erreur", () => {
    expect(parseBdtaCsv("", { reference: REF })).toMatchObject({ rows: [], errors: [] });
  });

  it("header sans colonne boucle → erreur explicite", () => {
    const csv = "Sexe;Naissance\nF;15.03.2022";
    const result = parseBdtaCsv(csv, { reference: REF });
    expect(result.rows).toEqual([]);
    expect(result.errors[0].raison).toContain("boucle");
  });

  it("guillemets autour des cellules avec ; interne", () => {
    const csv = [
      "Boucle;Sexe;Naissance;Race",
      `"CH 12.345.6789.0";F;15.03.2022;"Brune; suisse"`,
    ].join("\n");
    const result = parseBdtaCsv(csv, { reference: REF });
    expect(result.rows[0].race).toBe("Brune; suisse");
  });
});
