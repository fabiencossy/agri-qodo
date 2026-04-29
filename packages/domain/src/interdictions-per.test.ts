import { describe, expect, it } from "vitest";
import { DEFAULT_INTERDICTIONS_CONFIG, estFumureOrganiqueInterdite } from "./interdictions-per";

describe("estFumureOrganiqueInterdite", () => {
  it("ZA Plateau : 1er décembre interdit", () => {
    const r = estFumureOrganiqueInterdite(new Date("2026-12-01T00:00:00Z"), "ZA");
    expect(r.interdit).toBe(true);
    expect(r.raison).toMatch(/hivernale/);
    expect(r.prochaineFenetreOuverture).toBe("2027-02-16");
  });

  it("ZA Plateau : 15 mars autorisé", () => {
    const r = estFumureOrganiqueInterdite(new Date("2026-03-15T00:00:00Z"), "ZA");
    expect(r.interdit).toBe(false);
  });

  it("ZA : 14 février encore interdit, 16 février ok", () => {
    expect(estFumureOrganiqueInterdite(new Date("2026-02-14T00:00:00Z"), "ZA").interdit).toBe(true);
    expect(estFumureOrganiqueInterdite(new Date("2026-02-16T00:00:00Z"), "ZA").interdit).toBe(
      false,
    );
  });

  it("ZA : 14 novembre ok, 15 novembre interdit", () => {
    expect(estFumureOrganiqueInterdite(new Date("2026-11-14T00:00:00Z"), "ZA").interdit).toBe(
      false,
    );
    expect(estFumureOrganiqueInterdite(new Date("2026-11-15T00:00:00Z"), "ZA").interdit).toBe(true);
  });

  it("Montagne IV : 1er avril encore interdit, 16 avril ok", () => {
    expect(estFumureOrganiqueInterdite(new Date("2026-04-01T00:00:00Z"), "ZM4").interdit).toBe(
      true,
    );
    expect(estFumureOrganiqueInterdite(new Date("2026-04-16T00:00:00Z"), "ZM4").interdit).toBe(
      false,
    );
  });

  it("Zone inconnue : pas d'interdiction (fail-safe)", () => {
    const r = estFumureOrganiqueInterdite(new Date("2026-12-01T00:00:00Z"), "ZONE_X");
    expect(r.interdit).toBe(false);
    expect(r.raison).toBeNull();
  });

  it("prochaineFenetreOuverture : début janvier ZA → 16 février même année", () => {
    const r = estFumureOrganiqueInterdite(new Date("2026-01-15T00:00:00Z"), "ZA");
    expect(r.prochaineFenetreOuverture).toBe("2026-02-16");
  });

  it("Config personnalisée : surcharge possible", () => {
    const custom = {
      fumureOrganiqueParZone: {
        ZA: [{ debut: "01-01", fin: "12-31", raison: "Test : tout interdit" }],
      },
    };
    const r = estFumureOrganiqueInterdite(new Date("2026-07-15T00:00:00Z"), "ZA", custom);
    expect(r.interdit).toBe(true);
  });

  it("Config par défaut couvre 7 zones (ZA, ZP, ZM1-4, ZE)", () => {
    const zones = Object.keys(DEFAULT_INTERDICTIONS_CONFIG.fumureOrganiqueParZone);
    expect(zones).toHaveLength(7);
    expect(zones).toContain("ZA");
    expect(zones).toContain("ZE");
  });
});
