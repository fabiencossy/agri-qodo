import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOdooClient } from "./client";
import { OdooAuthError, OdooError } from "./types";

const VERSION_RESPONSE = {
  result: {
    server_version: "19.0+e",
    server_version_info: [19, 0, 0, "final", 0, "e"],
    server_serie: "19.0",
    protocol_version: 1,
  },
};

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function mockFetchSequence(responses: Array<unknown>) {
  let i = 0;
  return vi.fn(async (..._args: FetchArgs) => {
    const r = responses[i++];
    if (r === undefined) throw new Error("Plus de réponses mock disponibles");
    return new Response(JSON.stringify(r), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function bodyOfCall(
  mock: ReturnType<typeof mockFetchSequence>,
  index: number,
): {
  params: { method: string; service: string; args: unknown[] };
} {
  const call = mock.mock.calls[index] as FetchArgs | undefined;
  if (!call?.[1]?.body) throw new Error(`Pas de body sur l'appel #${index}`);
  return JSON.parse(call[1].body as string) as {
    params: { method: string; service: string; args: unknown[] };
  };
}

describe("createOdooClient", () => {
  const baseConfig = {
    url: "https://test.odoo.com",
    database: "testdb",
    username: "agri-qodo@test.com",
    apiKey: "secret-key",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T18:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("récupère la version Odoo via common.version()", async () => {
    globalThis.fetch = mockFetchSequence([VERSION_RESPONSE]);
    const client = createOdooClient(baseConfig);
    const v = await client.version();
    expect(v.serverVersion).toBe("19.0+e");
    expect(v.serverVersionInfo[0]).toBe(19);
  });

  it("authentifie : version + authenticate, expose uid + majorVersion", async () => {
    globalThis.fetch = mockFetchSequence([VERSION_RESPONSE, { result: 7 }]);
    const client = createOdooClient(baseConfig);
    const session = await client.authenticate();
    expect(session.uid).toBe(7);
    expect(session.majorVersion).toBe(19);
    expect(client.getSession()).toEqual(session);
  });

  it("rejette OdooAuthError quand Odoo répond uid=false", async () => {
    globalThis.fetch = mockFetchSequence([VERSION_RESPONSE, { result: false }]);
    const client = createOdooClient(baseConfig);
    await expect(client.authenticate()).rejects.toBeInstanceOf(OdooAuthError);
  });

  it("rejette OdooAuthError sur AccessDenied serveur", async () => {
    globalThis.fetch = mockFetchSequence([
      VERSION_RESPONSE,
      {
        error: {
          code: 100,
          message: "Odoo Server Error",
          data: { name: "odoo.exceptions.AccessDenied", message: "Access Denied" },
        },
      },
    ]);
    const client = createOdooClient(baseConfig);
    await expect(client.authenticate()).rejects.toBeInstanceOf(OdooAuthError);
  });

  it("searchRead transmet domain + fields/limit/order via execute_kw", async () => {
    const fetchMock = mockFetchSequence([
      VERSION_RESPONSE,
      { result: 12 },
      { result: [{ id: 1, name: "Foo" }] },
    ]);
    globalThis.fetch = fetchMock;
    const client = createOdooClient(baseConfig);
    const result = await client.searchRead("res.partner", [["is_company", "=", true]], {
      fields: ["id", "name"],
      limit: 50,
      order: "name asc",
    });
    expect(result).toEqual([{ id: 1, name: "Foo" }]);
    const body = bodyOfCall(fetchMock, 2);
    expect(body.params.method).toBe("execute_kw");
    expect(body.params.args[0]).toBe("testdb");
    expect(body.params.args[1]).toBe(12);
    expect(body.params.args[2]).toBe("secret-key");
    expect(body.params.args[3]).toBe("res.partner");
    expect(body.params.args[4]).toBe("search_read");
    expect(body.params.args[5]).toEqual([[["is_company", "=", true]]]);
    expect(body.params.args[6]).toEqual({ fields: ["id", "name"], limit: 50, order: "name asc" });
  });

  it("create renvoie l'id (single)", async () => {
    globalThis.fetch = mockFetchSequence([VERSION_RESPONSE, { result: 1 }, { result: 42 }]);
    const client = createOdooClient(baseConfig);
    const id = await client.create("res.partner", { name: "Test SARL" });
    expect(id).toBe(42);
  });

  it("create renvoie premier id si Odoo répond une liste", async () => {
    globalThis.fetch = mockFetchSequence([VERSION_RESPONSE, { result: 1 }, { result: [88, 89] }]);
    const client = createOdooClient(baseConfig);
    const id = await client.create("res.partner", { name: "Test" });
    expect(id).toBe(88);
  });

  it("write passe [ids, values] dans args", async () => {
    const fetchMock = mockFetchSequence([VERSION_RESPONSE, { result: 1 }, { result: true }]);
    globalThis.fetch = fetchMock;
    const client = createOdooClient(baseConfig);
    const ok = await client.write("res.partner", [42], { email: "x@x.ch" });
    expect(ok).toBe(true);
    const body = bodyOfCall(fetchMock, 2);
    expect(body.params.args[5]).toEqual([[42], { email: "x@x.ch" }]);
  });

  it("session est cachée — un seul authenticate sur 2 searchRead consécutifs", async () => {
    const fetchMock = mockFetchSequence([
      VERSION_RESPONSE,
      { result: 1 },
      { result: [] },
      { result: [] },
    ]);
    globalThis.fetch = fetchMock;
    const client = createOdooClient(baseConfig);
    await client.searchRead("res.partner", []);
    await client.searchRead("res.partner", []);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("normalise URL avec trailing slash", async () => {
    const fetchMock = mockFetchSequence([VERSION_RESPONSE]);
    globalThis.fetch = fetchMock;
    const client = createOdooClient({ ...baseConfig, url: "https://test.odoo.com//" });
    await client.version();
    const call = fetchMock.mock.calls[0] as FetchArgs | undefined;
    if (!call) throw new Error("fetch attendu");
    expect(call[0]).toBe("https://test.odoo.com/jsonrpc");
  });

  it("propage OdooError sur HTTP 5xx", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    const client = createOdooClient(baseConfig);
    await expect(client.version()).rejects.toBeInstanceOf(OdooError);
  });
});
