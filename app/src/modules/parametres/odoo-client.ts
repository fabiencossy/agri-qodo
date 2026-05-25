/**
 * Client XML-RPC Odoo — usage côté navigateur via proxy Vercel Edge.
 *
 * Couvre :
 *   - `version()` sur /xmlrpc/2/common (sans auth)
 *   - `authenticate(db, login, key)` sur /xmlrpc/2/common (retourne uid > 0)
 *   - `execute_kw(db, uid, key, model, method, args, kwargs?)` sur
 *     /xmlrpc/2/object — utilisé pour search_read, create, write, unlink…
 *
 * Les requêtes passent par notre Vercel Edge Function `/api/odoo-proxy` car
 * Odoo SaaS (*.odoo.com) ne renvoie pas d'en-têtes CORS pour les origines
 * tierces. Le proxy whiteliste les domaines Odoo autorisés et limite
 * l'endpoint au path /xmlrpc/*.
 */

const PROXY_BASE = '/api/odoo-proxy';

export interface OdooConnectionDetails {
  url: string;
  database: string;
  login: string;
  apiKey: string;
}

export interface OdooVersionInfo {
  serverVersion: string;
  serverVersionInfo?: ReadonlyArray<number | string>;
  protocolVersion?: number;
}

export interface OdooTestResult {
  ok: true;
  version: OdooVersionInfo;
  uid: number;
}

export interface OdooTestFailure {
  ok: false;
  /** Étape qui a échoué : 'version' (réseau/CORS) ou 'authenticate' (creds). */
  stage: 'version' | 'authenticate';
  message: string;
}

/** Effectue les deux appels et retourne soit succès, soit l'étape qui casse. */
export async function testOdooConnection(
  details: OdooConnectionDetails,
): Promise<OdooTestResult | OdooTestFailure> {
  const base = details.url.replace(/\/+$/, '');
  let version: OdooVersionInfo;
  try {
    version = await callVersion(base);
  } catch (e) {
    return {
      ok: false,
      stage: 'version',
      message: humanizeFetchError(e, base),
    };
  }
  let uid: number;
  try {
    uid = await callAuthenticate(base, details.database, details.login, details.apiKey);
  } catch (e) {
    return {
      ok: false,
      stage: 'authenticate',
      message: humanizeFetchError(e, base),
    };
  }
  if (!uid || uid <= 0) {
    return {
      ok: false,
      stage: 'authenticate',
      message: 'Authentification refusée par Odoo. Vérifiez la base, le login et la clé API.',
    };
  }
  return { ok: true, version, uid };
}

/* ─── Appels XML-RPC ──────────────────────────────────────────────────── */

async function callVersion(baseUrl: string): Promise<OdooVersionInfo> {
  const payload = `<?xml version="1.0"?>
<methodCall>
  <methodName>version</methodName>
  <params/>
</methodCall>`;
  const result = await xmlrpcCall(`${baseUrl}/xmlrpc/2/common`, payload);
  const struct = result as Record<string, unknown>;
  return {
    serverVersion: String(struct['server_version'] ?? '(inconnue)'),
    serverVersionInfo: struct['server_version_info'] as ReadonlyArray<number | string> | undefined,
    protocolVersion: struct['protocol_version'] as number | undefined,
  };
}

async function callAuthenticate(
  baseUrl: string,
  db: string,
  login: string,
  key: string,
): Promise<number> {
  const payload = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${escapeXml(db)}</string></value></param>
    <param><value><string>${escapeXml(login)}</string></value></param>
    <param><value><string>${escapeXml(key)}</string></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>`;
  const result = await xmlrpcCall(`${baseUrl}/xmlrpc/2/common`, payload);
  // Soit int (uid), soit false → 0
  if (typeof result === 'number') return result;
  if (result === false) return 0;
  return 0;
}

/* ─── execute_kw — appel générique méthode modèle Odoo ────────────────── */

/**
 * Appel ORM Odoo. Exemples :
 *   executeKw(conn, uid, 'res.partner', 'search_read',
 *     [[['is_company', '=', true]]],
 *     { fields: ['id','name','email'], limit: 1000 })
 *   executeKw(conn, uid, 'res.partner', 'create', [{ name: 'X', email: 'a@b' }])
 *   executeKw(conn, uid, 'res.partner', 'write', [[42], { phone: '0...' }])
 */
export async function executeKw(
  details: OdooConnectionDetails,
  uid: number,
  model: string,
  method: string,
  args: unknown[],
  kwargs?: Record<string, unknown>,
): Promise<unknown> {
  const base = details.url.replace(/\/+$/, '');
  const payload = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${escapeXml(details.database)}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${escapeXml(details.apiKey)}</string></value></param>
    <param><value><string>${escapeXml(model)}</string></value></param>
    <param><value><string>${escapeXml(method)}</string></value></param>
    <param>${valueToXml(args)}</param>
    <param>${valueToXml(kwargs ?? {})}</param>
  </params>
</methodCall>`;
  return await xmlrpcCall(`${base}/xmlrpc/2/object`, payload);
}

/** Sérialise une valeur JS vers <value>…</value> XML-RPC. */
function valueToXml(v: unknown): string {
  if (v === null || v === undefined) return '<value><nil/></value>';
  if (typeof v === 'boolean') return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return `<value><int>${v}</int></value>`;
    return `<value><double>${v}</double></value>`;
  }
  if (typeof v === 'string') return `<value><string>${escapeXml(v)}</string></value>`;
  if (Array.isArray(v)) {
    const inner = v.map((it) => valueToXml(it)).join('');
    return `<value><array><data>${inner}</data></array></value>`;
  }
  if (typeof v === 'object') {
    const members = Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `<member><name>${escapeXml(k)}</name>${valueToXml(val)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return '<value><string/></value>';
}

/* ─── Transport + parsing ─────────────────────────────────────────────── */

async function xmlrpcCall(endpoint: string, body: string): Promise<unknown> {
  // Passe par le proxy Vercel Edge pour contourner CORS d'Odoo SaaS.
  const proxied = `${PROXY_BASE}?url=${encodeURIComponent(endpoint)}`;
  const res = await fetch(proxied, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
  }
  const text = await res.text();
  return parseXmlrpcResponse(text);
}

function parseXmlrpcResponse(xml: string): unknown {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Réponse XML invalide.');
  }
  const fault = doc.querySelector('fault > value');
  if (fault) {
    const faultObj = parseValueNode(fault) as Record<string, unknown> | null;
    const msg =
      faultObj && typeof faultObj['faultString'] === 'string'
        ? (faultObj['faultString'] as string)
        : 'Erreur Odoo (fault).';
    throw new Error(msg);
  }
  const param = doc.querySelector('params > param > value');
  if (!param) return null;
  return parseValueNode(param);
}

function parseValueNode(node: Element): unknown {
  // <value>… peut contenir directement du texte (string implicite) ou un type
  const child = firstElementChild(node);
  if (!child) return node.textContent ?? '';
  switch (child.tagName.toLowerCase()) {
    case 'string':
      return child.textContent ?? '';
    case 'int':
    case 'i4':
      return parseInt(child.textContent ?? '0', 10);
    case 'double':
      return parseFloat(child.textContent ?? '0');
    case 'boolean':
      return child.textContent === '1';
    case 'nil':
      return null;
    case 'array': {
      const arr: unknown[] = [];
      child.querySelectorAll(':scope > data > value').forEach((v) => arr.push(parseValueNode(v)));
      return arr;
    }
    case 'struct': {
      const obj: Record<string, unknown> = {};
      child.querySelectorAll(':scope > member').forEach((m) => {
        const name = m.querySelector(':scope > name')?.textContent ?? '';
        const value = m.querySelector(':scope > value');
        obj[name] = value ? parseValueNode(value) : null;
      });
      return obj;
    }
    default:
      return child.textContent ?? '';
  }
}

function firstElementChild(node: Element): Element | null {
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (c) return c;
  }
  return null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function humanizeFetchError(e: unknown, baseUrl: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return `Le proxy /api/odoo-proxy n'a pas pu joindre ${baseUrl}. Vérifiez l'URL et que l'instance Odoo est en ligne.`;
  }
  if (msg.includes('403')) {
    return `Domaine non autorisé par le proxy. ${baseUrl} doit matcher *.odoo.com / *.odoo.sh / odoo.<domaine>.<tld>.`;
  }
  return msg;
}
