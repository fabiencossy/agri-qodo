import { describe, expect, it } from "vitest";
import { pickAdapter } from "./version-adapter";

describe("pickAdapter", () => {
  it("renvoie l'adapter v19 pour 19", () => {
    const a = pickAdapter(19);
    expect(a.majorVersion).toBe(19);
    expect(a.saleOrderModel).toBe("sale.order");
    expect(a.saleOrderConfirmMethod).toBe("action_confirm");
  });

  it("renvoie l'adapter v20 pour 20+", () => {
    expect(pickAdapter(20).majorVersion).toBe(20);
    expect(pickAdapter(21).majorVersion).toBe(20); // hérite de v20 par défaut
  });

  it("rejette les versions <19", () => {
    expect(() => pickAdapter(18)).toThrow(/non supportée/);
    expect(() => pickAdapter(15)).toThrow(/Enterprise 19/);
  });
});
