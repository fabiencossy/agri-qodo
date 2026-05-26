/**
 * Vercel Edge Function — proxy XML-RPC pour Odoo.
 *
 * Le navigateur ne peut pas appeler directement Odoo SaaS (*.odoo.com) car
 * Odoo ne renvoie pas les en-têtes CORS pour les origines tierces. Cette
 * fonction sert d'intermédiaire :
 *   navigateur → /api/odoo-proxy?url=ENCODED → cette fonction → Odoo XML-RPC
 *
 * Sécurité : on n'autorise que les URLs Odoo (https://*.odoo.com ou
 * https://*.odoo.exploitation.ch et alike) — pas un proxy ouvert pour
 * empêcher SSRF.
 */

export const config = {
  runtime: 'edge',
};

const ALLOWED_HOST_PATTERNS = [
  /^[a-z0-9-]+\.odoo\.com$/i,
  /^[a-z0-9-]+\.odoo\.sh$/i,
  /^odoo\.[a-z0-9-]+\.[a-z]{2,}$/i, // odoo.exploitation.ch, odoo.darval.ch, etc.
  /^[a-z0-9-]+\.qodo\.ch$/i,
];

function isAllowedTarget(target: URL): boolean {
  if (target.protocol !== 'https:') return false;
  return ALLOWED_HOST_PATTERNS.some((re) => re.test(target.hostname));
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(req) });
  }

  const url = new URL(req.url);
  const targetParam = url.searchParams.get('url');
  if (!targetParam) {
    return new Response('Paramètre "url" manquant', {
      status: 400,
      headers: corsHeaders(req),
    });
  }

  let target: URL;
  try {
    target = new URL(targetParam);
  } catch {
    return new Response('URL cible invalide', { status: 400, headers: corsHeaders(req) });
  }

  if (!isAllowedTarget(target)) {
    return new Response(`Domaine non autorisé : ${target.hostname}`, {
      status: 403,
      headers: corsHeaders(req),
    });
  }

  // Seul le path /xmlrpc/... est autorisé pour limiter la surface
  if (!target.pathname.startsWith('/xmlrpc/')) {
    return new Response('Seuls les endpoints /xmlrpc/* sont proxifiés', {
      status: 403,
      headers: corsHeaders(req),
    });
  }

  // Limite de taille du body (audit R-003) — XML-RPC est compact, 64 Ko suffit
  const MAX_BODY = 64 * 1024;
  const body = await req.text();
  if (body.length > MAX_BODY) {
    return new Response('Payload trop grand', { status: 413, headers: corsHeaders(req) });
  }
  try {
    const upstream = await fetch(target.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        ...corsHeaders(req),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Proxy fetch error: ${message}`, {
      status: 502,
      headers: corsHeaders(req),
    });
  }
}

// SÉCURITÉ (audit F-002, 2026-05-25) : whitelist stricte d'origines. Réflichir
// l'Origin reçu = ouvrir CORS à tout site tiers (CSRF-like). Refusé.
const ALLOWED_ORIGINS = new Set([
  'https://agri.qodo.ch',
  'https://newagri.qodo.ch',
  'http://localhost:5173',
  'http://localhost:4173', // preview Vite
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://agri.qodo.ch';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
