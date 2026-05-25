/**
 * Sync bidirectionnel AgriQodo ThirdPartyClient ↔ Odoo res.partner.
 *
 * MVP : sync manuel déclenché depuis ClientsSection. Trois opérations :
 *   - pullFromOdoo(): tire les res.partner is_company=true → upsert local.
 *     Match par odooPartnerId si présent, sinon par email (case-insensitive),
 *     sinon par name + city. Crée local si rien ne match.
 *   - pushToOdoo(): pour chaque client AgriQodo sans odooPartnerId, create
 *     res.partner. Pour ceux avec odooPartnerId, write les modifs locales.
 *   - syncBidirectional(): pull puis push, retourne stats.
 *
 * Limitations MVP :
 *   - Pas de détection de conflit (last-write-wins, c'est l'opération la
 *     plus récente qui gagne).
 *   - Pas de gestion contacts individuels (is_company=false). Tout client
 *     AgriQodo est créé en is_company=true.
 *   - Pas de soft delete. removeClient local ne supprime PAS dans Odoo.
 *   - Pas de pagination — limite 500 partners (couvre la quasi-totalité des
 *     exploitations).
 */

import { addClient, getClients, updateClient } from '../travaux/travaux.store';
import type { ThirdPartyClient } from '../travaux/travaux.types';
import { executeKw, testOdooConnection, type OdooConnectionDetails } from './odoo-client';

export interface SyncResult {
  ok: true;
  pulled: number;
  pushed: number;
  updated: number;
  errors: ReadonlyArray<string>;
}

export interface SyncFailure {
  ok: false;
  stage: 'auth' | 'pull' | 'push';
  message: string;
}

const PARTNER_FIELDS = [
  'id',
  'name',
  'email',
  'phone',
  'mobile',
  'city',
  'vat',
  'active',
  'comment',
  'is_company',
  'write_date',
];

interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  city: string | false;
  vat: string | false;
  active: boolean;
  comment: string | false;
  is_company: boolean;
  write_date: string | false;
}

function s(v: string | false | undefined): string | undefined {
  if (!v) return undefined;
  const t = String(v).trim();
  return t === '' ? undefined : t;
}

/** Authentifie + retourne uid. */
async function authenticate(conn: OdooConnectionDetails): Promise<number> {
  const test = await testOdooConnection(conn);
  if (!test.ok) {
    throw new Error(`Auth Odoo : ${test.message}`);
  }
  return test.uid;
}

/** Pull : récupère les res.partner is_company=true et upsert local. */
export async function pullFromOdoo(conn: OdooConnectionDetails): Promise<SyncResult | SyncFailure> {
  let uid: number;
  try {
    uid = await authenticate(conn);
  } catch (e) {
    return { ok: false, stage: 'auth', message: e instanceof Error ? e.message : String(e) };
  }

  try {
    const raw = (await executeKw(
      conn,
      uid,
      'res.partner',
      'search_read',
      [
        [
          ['is_company', '=', true],
          ['active', '=', true],
        ],
      ],
      { fields: PARTNER_FIELDS, limit: 500 },
    )) as OdooPartner[];

    const localClients = getClients();
    const localByOdooId = new Map<number, ThirdPartyClient>(
      localClients
        .filter((c) => typeof c.odooPartnerId === 'number')
        .map((c) => [c.odooPartnerId as number, c]),
    );
    const localByEmail = new Map<string, ThirdPartyClient>(
      localClients.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]),
    );

    let pulled = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const p of raw) {
      try {
        const existing =
          localByOdooId.get(p.id) ??
          (p.email ? localByEmail.get(String(p.email).toLowerCase()) : undefined);

        const fields: Partial<ThirdPartyClient> = {
          name: p.name,
          email: s(p.email),
          phone: s(p.phone) ?? s(p.mobile),
          city: s(p.city),
          vatNumber: s(p.vat),
          notes: s(p.comment),
          active: p.active,
          odooPartnerId: p.id,
        };

        if (existing) {
          // Update local si quelque chose a changé
          const existingMap = existing as unknown as Record<string, unknown>;
          const changed = Object.entries(fields).some(([k, v]) => existingMap[k] !== v);
          if (changed) {
            await updateClient(existing.id, fields);
            updated++;
          }
        } else {
          const newClient: ThirdPartyClient = {
            id: `C-${Date.now()}-${p.id}`,
            name: p.name || '(sans nom)',
            ...fields,
          } as ThirdPartyClient;
          await addClient(newClient);
          pulled++;
        }
      } catch (e) {
        errors.push(`Partner #${p.id} ${p.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { ok: true, pulled, pushed: 0, updated, errors };
  } catch (e) {
    return { ok: false, stage: 'pull', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Push : envoie les clients locaux vers Odoo. */
export async function pushToOdoo(conn: OdooConnectionDetails): Promise<SyncResult | SyncFailure> {
  let uid: number;
  try {
    uid = await authenticate(conn);
  } catch (e) {
    return { ok: false, stage: 'auth', message: e instanceof Error ? e.message : String(e) };
  }

  const localClients = getClients();
  let pushed = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const c of localClients) {
    try {
      const vals = {
        name: c.name,
        email: c.email ?? false,
        phone: c.phone ?? false,
        city: c.city ?? false,
        vat: c.vatNumber ?? false,
        comment: c.notes ?? false,
        active: c.active,
        is_company: true,
        customer_rank: 1,
      };
      if (typeof c.odooPartnerId === 'number') {
        // Update existant
        await executeKw(conn, uid, 'res.partner', 'write', [[c.odooPartnerId], vals]);
        updated++;
      } else {
        // Create + récupère id
        const newId = (await executeKw(conn, uid, 'res.partner', 'create', [vals])) as number;
        if (typeof newId === 'number' && newId > 0) {
          await updateClient(c.id, { odooPartnerId: newId });
          pushed++;
        }
      }
    } catch (e) {
      errors.push(`Client ${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { ok: true, pulled: 0, pushed, updated, errors };
}

/** Sync complet : pull puis push. */
export async function syncBidirectional(
  conn: OdooConnectionDetails,
): Promise<SyncResult | SyncFailure> {
  const pull = await pullFromOdoo(conn);
  if (!pull.ok) return pull;
  const push = await pushToOdoo(conn);
  if (!push.ok) return push;
  return {
    ok: true,
    pulled: pull.pulled,
    pushed: push.pushed,
    updated: pull.updated + push.updated,
    errors: [...pull.errors, ...push.errors],
  };
}
