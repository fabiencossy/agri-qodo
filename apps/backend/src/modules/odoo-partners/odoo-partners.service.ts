/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

export interface CreateClientRapideInput {
  nom: string;
  ville?: string;
  npa?: string;
  adresse?: string;
  email?: string;
  telephone?: string;
}

interface OdooPartnerRow {
  id: number;
  name: string;
  email?: string | false;
  phone?: string | false;
  city?: string | false;
  zip?: string | false;
  street?: string | false;
}

export interface OdooPartnerOut {
  odooId: number;
  name: string;
  email: string | null;
  phone: string | null;
  ville: string | null;
  npa: string | null;
  adresse: string | null;
  /** Si défini : ce client Odoo est aussi sur Agri Qodo via PartnerLink. */
  linkedExploitationId: string | null;
  linkedExploitationNom: string | null;
}

/**
 * Service Odoo res.partner / project.project pour Agri Qodo.
 *
 * Décision Fabien 2026-05-06 : un client Odoo n'est PAS un partenaire
 * Agri Qodo. Le sélecteur Client peut retourner soit :
 *   - un `partenaireId` (UUID Exploitation) → vrai partenaire Agri Qodo
 *     (qui a accepté un PartnerLink ACTIVE)
 *   - un `odooPartnerId` (Int) → simple destinataire de devis Odoo
 *
 * Le mapping res.partner ↔ Exploitation se fait via
 * `PartnerLink.odooPartnerId` quand il existe — pas auto-créé pour les
 * clients Odoo non-partenaires.
 */
@Injectable()
export class OdooPartnersService {
  private readonly log = new Logger(OdooPartnersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClientManager,
  ) {}

  async listClients(tenantId: string): Promise<OdooPartnerOut[]> {
    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) return [];

    let rows: OdooPartnerRow[] = [];
    try {
      rows = await client.searchRead<OdooPartnerRow>(
        "res.partner",
        [
          ["active", "=", true],
          ["is_company", "=", true],
        ],
        {
          fields: ["id", "name", "email", "phone", "city", "zip", "street"],
          limit: 500,
          order: "name asc",
        },
      );
    } catch (e) {
      this.log.warn(`Échec listage res.partner Odoo : ${(e as Error).message}`);
      return [];
    }

    if (rows.length === 0) return [];

    // Mapping inverse : pour chaque odooPartnerId, retrouver le PartnerLink
    // ACTIVE (= vrai partenaire Agri Qodo qui a accepté). Les liens
    // PENDING/REVOKED ne comptent pas.
    const odooIds = rows.map((r) => r.id);
    const links = await this.prisma.partnerLink.findMany({
      where: {
        ownerTenantId: tenantId,
        odooPartnerId: { in: odooIds },
        status: "ACTIVE",
      },
      include: {
        partnerTenant: { select: { nom: true } },
      },
    });
    const byOdooId = new Map<number, { exploitationId: string; nom: string }>();
    for (const l of links) {
      if (l.odooPartnerId == null) continue;
      byOdooId.set(l.odooPartnerId, {
        exploitationId: l.partnerTenantId,
        nom: l.partnerTenant.nom,
      });
    }

    return rows.map((r) => {
      const linked = byOdooId.get(r.id);
      return {
        odooId: r.id,
        name: r.name,
        email: typeof r.email === "string" ? r.email : null,
        phone: typeof r.phone === "string" ? r.phone : null,
        ville: typeof r.city === "string" ? r.city : null,
        npa: typeof r.zip === "string" ? r.zip : null,
        adresse: typeof r.street === "string" ? r.street : null,
        linkedExploitationId: linked?.exploitationId ?? null,
        linkedExploitationNom: linked?.nom ?? null,
      };
    });
  }

  /**
   * Création rapide d'un res.partner Odoo (sans Exploitation Agri Qodo).
   * Décision Fabien 2026-05-06 : un client Odoo n'est PAS un partenaire
   * Agri Qodo — on stocke juste l'ID Odoo côté Travail.odooPartnerId.
   *
   * Retourne l'`odooPartnerId` créé (toujours non-null si Odoo configuré).
   */
  async createQuickClient(
    tenantId: string,
    input: CreateClientRapideInput,
  ): Promise<{ odooPartnerId: number; name: string }> {
    const client = await this.odoo.forTenant(tenantId);
    const odooPartnerId = await client.create("res.partner", {
      name: input.nom.trim(),
      customer_rank: 1,
      ...(input.email ? { email: input.email } : {}),
      ...(input.telephone ? { phone: input.telephone } : {}),
      ...(input.ville ? { city: input.ville } : {}),
      ...(input.npa ? { zip: input.npa } : {}),
      ...(input.adresse ? { street: input.adresse } : {}),
    });
    this.log.log(`createQuickClient Odoo: name=${input.nom} → odoo res.partner=${odooPartnerId}`);
    return { odooPartnerId, name: input.nom.trim() };
  }

  /**
   * Liste les `project.project` Odoo actifs du tenant. Vide si Odoo non
   * configuré. Alimente les 3 sélecteurs de /parametres/exploitation.
   */
  async listProjects(tenantId: string): Promise<Array<{ odooId: number; name: string }>> {
    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) return [];
    try {
      const rows = await client.searchRead<{ id: number; name: string }>(
        "project.project",
        [["active", "=", true]],
        { fields: ["id", "name"], limit: 200, order: "name asc" },
      );
      return rows.map((r) => ({ odooId: r.id, name: r.name }));
    } catch (e) {
      this.log.warn(`Échec listage project.project Odoo : ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * Liste les `hr.employee` Odoo actifs du tenant. Vide si Odoo non
   * configuré ou si le module hr n'est pas installé. Alimente le select
   * "Employé Odoo" sur /utilisateurs (mapping User.odooEmployeeId pour
   * que les timesheets remontent au bon employé Odoo).
   */
  async listEmployees(
    tenantId: string,
  ): Promise<Array<{ odooId: number; name: string; workEmail: string | null }>> {
    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (!client) return [];
    try {
      const rows = await client.searchRead<{
        id: number;
        name: string;
        work_email?: string | false;
      }>("hr.employee", [["active", "=", true]], {
        fields: ["id", "name", "work_email"],
        limit: 500,
        order: "name asc",
      });
      return rows.map((r) => ({
        odooId: r.id,
        name: r.name,
        workEmail: typeof r.work_email === "string" ? r.work_email : null,
      }));
    } catch (e) {
      this.log.warn(`Échec listage hr.employee Odoo : ${(e as Error).message}`);
      return [];
    }
  }
}
