/**
 * Client Odoo Enterprise — JSON-RPC 2.0 sur /jsonrpc.
 *
 * Pourquoi JSON-RPC plutôt que XML-RPC ? Odoo 16+ supporte les deux,
 * mais JSON-RPC est :
 *   - natif fetch (pas de dépendance externe `xmlrpc`)
 *   - mieux typé (JSON arrive parsé, vs XML qu'il faut décoder)
 *   - plus rapide (pas d'overhead XML)
 *   - cohérent avec le reste de la stack (NestJS, Next.js)
 *
 * Une instance = une connexion à un tenant. Pour parler à plusieurs
 * exploitations Odoo en parallèle, créer N instances (cf
 * `OdooClientManager` côté backend NestJS, PR-C).
 *
 * Auth : `authenticate()` est appelée automatiquement à la première
 * requête qui en a besoin. Le `uid` est mis en cache. On ne stocke PAS
 * de session cookie — chaque appel re-soumet (db, uid, api_key) car
 * c'est sans état pour `execute_kw`.
 *
 * Multi-version : la version réelle est résolue à `authenticate()` via
 * `common.version()`. Le `majorVersion` est exposé pour que les adapters
 * (cf `version-adapter.ts`) puissent ajuster les appels par version.
 */

import {
  type AuthenticatedSession,
  type OdooConnectionConfig,
  OdooAuthError,
  OdooError,
  type OdooDomain,
  type OdooVersion,
  type SearchReadOptions,
} from "./types";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: "call";
  params: {
    service: "common" | "object" | "db";
    method: string;
    args: unknown[];
  };
  id?: number;
}

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: number | null;
  result: T;
  error?: undefined;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number | null;
  result?: undefined;
  error: {
    code: number;
    message: string;
    data?: { name?: string; message?: string; debug?: string };
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

const DEFAULT_TIMEOUT_MS = 30_000;

export interface OdooClient {
  /** Renvoie la version Odoo détectée (sans déclencher l'auth). */
  version(): Promise<OdooVersion>;

  /** Authentifie + cache l'uid. Appelé auto au premier appel `execute_kw`. */
  authenticate(): Promise<AuthenticatedSession>;

  /**
   * Search + read combinés (le pattern Odoo standard). Renvoie une liste
   * d'enregistrements. `domain` accepte la syntaxe Odoo classique :
   * `[["name", "ilike", "Foo"], ["active", "=", true]]`.
   */
  searchRead<T = Record<string, unknown>>(
    model: string,
    domain: OdooDomain,
    options?: SearchReadOptions,
  ): Promise<T[]>;

  /** Création d'un enregistrement, renvoie l'id créé. */
  create(model: string, values: Record<string, unknown>): Promise<number>;

  /** Mise à jour. Renvoie true si OK. */
  write(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean>;

  /** Suppression. Renvoie true si OK. */
  unlink(model: string, ids: number[]): Promise<boolean>;

  /**
   * Appel générique `execute_kw` pour les méthodes custom non couvertes
   * ci-dessus (ex: `sale.advance.payment.inv`, `action_confirm`, etc.).
   */
  callKw<T = unknown>(
    model: string,
    method: string,
    args: unknown[],
    kwargs?: Record<string, unknown>,
  ): Promise<T>;

  /** Infos session courante (utile pour debug + observabilité). */
  getSession(): AuthenticatedSession | null;
}

/**
 * Crée un client Odoo isolé. Les instances ne partagent rien — sûr
 * d'utiliser plusieurs en parallèle dans le même process Node.
 */
export function createOdooClient(config: OdooConnectionConfig): OdooClient {
  const url = config.url.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let session: AuthenticatedSession | null = null;
  let cachedVersion: OdooVersion | null = null;

  async function jsonRpc<T>(payload: JsonRpcRequest): Promise<T> {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${url}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: payload.id ?? Date.now() }),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new OdooError(
        err instanceof Error ? `${err.name}: ${err.message}` : "Network error",
        0,
        err,
      );
    } finally {
      clearTimeout(tid);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new OdooError(
        `Odoo HTTP ${response.status}: ${body.slice(0, 200)}`,
        response.status,
        body,
      );
    }

    const json = (await response.json()) as JsonRpcResponse<T>;
    if (json.error) {
      const odooMsg = json.error.data?.message ?? json.error.message;
      const isAuth =
        json.error.data?.name === "odoo.exceptions.AccessDenied" ||
        /access denied|invalid (login|password|api[_ ]?key)/i.test(odooMsg);
      const ErrCtor = isAuth ? OdooAuthError : OdooError;
      throw new ErrCtor(odooMsg, isAuth ? 401 : (json.error.code ?? 500), json.error.data);
    }
    return json.result;
  }

  async function fetchVersion(): Promise<OdooVersion> {
    if (cachedVersion) return cachedVersion;
    const raw = await jsonRpc<{
      server_version: string;
      server_version_info: [number, number, number, string, number, string];
      server_serie?: string;
      protocol_version?: number;
    }>({
      jsonrpc: "2.0",
      method: "call",
      params: { service: "common", method: "version", args: [] },
    });
    cachedVersion = {
      serverVersion: raw.server_version,
      serverVersionInfo: raw.server_version_info,
      serverSerie: raw.server_serie ?? raw.server_version,
      protocolVersion: raw.protocol_version ?? 1,
    };
    return cachedVersion;
  }

  async function ensureSession(): Promise<AuthenticatedSession> {
    if (session) return session;
    const version = await fetchVersion();
    const uid = await jsonRpc<number | false>({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "authenticate",
        args: [config.database, config.username, config.apiKey, {}],
      },
    });
    if (typeof uid !== "number" || uid <= 0) {
      throw new OdooAuthError(
        `Échec d'authentification Odoo — vérifie database "${config.database}", username "${config.username}", et l'API key.`,
        { uid },
      );
    }
    session = {
      uid,
      version,
      majorVersion: version.serverVersionInfo[0],
    };
    return session;
  }

  async function executeKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    const s = await ensureSession();
    return jsonRpc<T>({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [config.database, s.uid, config.apiKey, model, method, args, kwargs],
      },
    });
  }

  return {
    version: fetchVersion,
    authenticate: ensureSession,

    async searchRead(model, domain, options) {
      const kwargs: Record<string, unknown> = {};
      if (options?.fields) kwargs.fields = options.fields;
      if (options?.offset !== undefined) kwargs.offset = options.offset;
      if (options?.limit !== undefined) kwargs.limit = options.limit;
      if (options?.order) kwargs.order = options.order;
      // search_read prend `domain` en 1er arg positionnel, les autres en kwargs.
      return executeKw(model, "search_read", [domain], kwargs);
    },

    async create(model, values) {
      // Odoo accepte `create([values])` ou `create(values)` selon la version.
      // Depuis 13, la signature batch [[values, ...]] retourne une liste d'ids.
      // On passe en single record et on prend le 1er id.
      const result = await executeKw<number | number[]>(model, "create", [values]);
      return Array.isArray(result) ? (result[0] ?? 0) : result;
    },

    async write(model, ids, values) {
      return executeKw<boolean>(model, "write", [ids, values]);
    },

    async unlink(model, ids) {
      return executeKw<boolean>(model, "unlink", [ids]);
    },

    async callKw(model, method, args, kwargs) {
      return executeKw(model, method, args, kwargs ?? {});
    },

    getSession() {
      return session;
    },
  };
}
