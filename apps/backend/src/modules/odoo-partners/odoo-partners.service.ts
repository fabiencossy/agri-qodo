/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Canton, PartnerLinkLevel, PartnerLinkStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
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
 * Sprint 2 fusion-interventions — sélecteur Client unifié.
 *
 * Liste les res.partner Odoo (côté tenant courant) marqués comme client
 * (customer_rank > 0). Pour chaque partner, on regarde dans la table
 * `PartnerLink` s'il y a déjà un mapping vers une Exploitation Agri Qodo
 * — auquel cas on expose `linkedExploitationId` pour permettre la
 * sélection cohérente côté Travail.partenaireId.
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

    // Récupère tous les res.partner actifs qui ne sont PAS des contacts
    // internes employés (parent_id null pour les sociétés/contacts directs).
    // Ce filtre fonctionne dans Odoo Community et Enterprise (v13+).
    // Note : on ne filtre pas par customer_rank car certaines instances
    // n'incrémentent pas ce champ automatiquement.
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
      this.log.log(`Odoo res.partner is_company=true → ${rows.length} clients`);
    } catch (e) {
      this.log.warn(`Échec listage res.partner Odoo : ${(e as Error).message}`);
      return [];
    }

    if (rows.length === 0) return [];

    // Mapping inverse : pour chaque odooPartnerId, retrouver le PartnerLink
    // côté owner=tenantId et l'Exploitation partenaire associée.
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
   * Création rapide d'un client depuis le sélecteur (Sprint 2). Crée :
   *  1. Une Exploitation Agri Qodo "shadow" (sans User actif) qui porte
   *     l'identité du client. Le `code` est auto-généré.
   *  2. Un PartnerLink ACTIVE liant le tenant courant à cette shadow,
   *     niveau LECTURE par défaut (le client peut être upgrade plus tard
   *     s'il rejoint vraiment Agri Qodo).
   *  3. Best-effort : un res.partner Odoo si Odoo configuré, mémorisé
   *     dans `PartnerLink.odooPartnerId`. Si Odoo down, le push se
   *     fera plus tard au save du Travail.
   *
   * Renvoie l'`exploitationId` shadow, utilisable direct en
   * `Travail.partenaireId`.
   */
  async createQuickClient(
    tenantId: string,
    input: CreateClientRapideInput,
  ): Promise<{ exploitationId: string; nom: string; odooPartnerId: number | null }> {
    const owner = await this.prisma.exploitation.findUniqueOrThrow({
      where: { id: tenantId },
      select: { canton: true },
    });

    // Code unique pour la shadow : AQ-SHADOW-{owner_canton}-{token8}
    const token = randomBytes(4).toString("hex").toUpperCase();
    const code = `AQ-SHADOW-${owner.canton}-${token}`;

    const shadow = await this.prisma.exploitation.create({
      data: {
        code,
        nom: input.nom.trim(),
        canton: owner.canton as Canton,
        ...(input.ville ? { localite: input.ville } : {}),
        ...(input.npa ? { npa: input.npa } : {}),
        ...(input.adresse ? { adresse: input.adresse } : {}),
        ...(input.email ? { emailContact: input.email } : {}),
        ...(input.telephone ? { telephone: input.telephone } : {}),
      },
    });

    // Best-effort : crée le res.partner Odoo en parallèle.
    let odooPartnerId: number | null = null;
    const client = await this.odoo.forTenant(tenantId).catch(() => null);
    if (client) {
      try {
        odooPartnerId = await client.create("res.partner", {
          name: shadow.nom,
          customer_rank: 1,
          ...(input.email ? { email: input.email } : {}),
          ...(input.telephone ? { phone: input.telephone } : {}),
          ...(input.ville ? { city: input.ville } : {}),
          ...(input.npa ? { zip: input.npa } : {}),
          ...(input.adresse ? { street: input.adresse } : {}),
        });
      } catch (e) {
        this.log.warn(
          `Création res.partner Odoo échouée pour ${shadow.nom} : ${(e as Error).message}`,
        );
      }
    }

    await this.prisma.partnerLink.create({
      data: {
        ownerTenantId: tenantId,
        partnerTenantId: shadow.id,
        niveau: PartnerLinkLevel.LECTURE,
        status: PartnerLinkStatus.ACTIVE,
        scope: {},
        grantedAt: new Date(),
        ...(odooPartnerId !== null ? { odooPartnerId } : {}),
      },
    });

    return { exploitationId: shadow.id, nom: shadow.nom, odooPartnerId };
  }

  /**
   * Sprint B prestations — sélection d'un client Odoo existant. Récupère
   * le res.partner via XML-RPC, crée une Exploitation shadow et le
   * PartnerLink mémorisant `odooPartnerId`, et renvoie l'`exploitationId`
   * sélectionnable côté Travail.partenaireId.
   *
   * Idempotent : si un PartnerLink avec ce `odooPartnerId` existe déjà
   * pour le tenant, on renvoie son `partnerTenantId` sans rien créer.
   */
  async linkOdooPartner(
    tenantId: string,
    odooPartnerId: number,
  ): Promise<{ exploitationId: string; nom: string }> {
    // 1. Idempotence : link existant ?
    const existing = await this.prisma.partnerLink.findFirst({
      where: { ownerTenantId: tenantId, odooPartnerId, status: "ACTIVE" },
      include: { partnerTenant: { select: { id: true, nom: true } } },
    });
    if (existing) {
      return {
        exploitationId: existing.partnerTenant.id,
        nom: existing.partnerTenant.nom,
      };
    }

    // 2. Lire le res.partner depuis Odoo pour récupérer nom + ville/etc.
    const client = await this.odoo.forTenant(tenantId);
    const rows = await client.searchRead<{
      id: number;
      name: string;
      city?: string | false;
      zip?: string | false;
      street?: string | false;
      email?: string | false;
      phone?: string | false;
    }>("res.partner", [["id", "=", odooPartnerId]], {
      fields: ["id", "name", "city", "zip", "street", "email", "phone"],
      limit: 1,
    });
    const partner = rows[0];
    if (!partner) {
      throw new NotFoundException(`res.partner #${odooPartnerId} introuvable côté Odoo`);
    }

    // 3. Créer l'Exploitation shadow + PartnerLink (réutilise la logique
    //    de createQuickClient mais sans recréer le res.partner Odoo).
    const owner = await this.prisma.exploitation.findUniqueOrThrow({
      where: { id: tenantId },
      select: { canton: true },
    });
    const token = randomBytes(4).toString("hex").toUpperCase();
    const code = `AQ-SHADOW-${owner.canton}-${token}`;

    const shadow = await this.prisma.exploitation.create({
      data: {
        code,
        nom: partner.name,
        canton: owner.canton as Canton,
        ...(typeof partner.city === "string" ? { localite: partner.city } : {}),
        ...(typeof partner.zip === "string" ? { npa: partner.zip } : {}),
        ...(typeof partner.street === "string" ? { adresse: partner.street } : {}),
        ...(typeof partner.email === "string" ? { emailContact: partner.email } : {}),
        ...(typeof partner.phone === "string" ? { telephone: partner.phone } : {}),
      },
    });

    await this.prisma.partnerLink.create({
      data: {
        ownerTenantId: tenantId,
        partnerTenantId: shadow.id,
        niveau: PartnerLinkLevel.LECTURE,
        status: PartnerLinkStatus.ACTIVE,
        scope: {},
        grantedAt: new Date(),
        odooPartnerId,
      },
    });

    this.log.log(`linkOdooPartner: odooId=${odooPartnerId} → exploitation shadow=${shadow.id}`);
    return { exploitationId: shadow.id, nom: shadow.nom };
  }

  /**
   * Sprint B prestations — liste les `project.project` Odoo du tenant.
   * Renvoyé tel quel pour alimenter les 3 sélecteurs dans
   * /parametres/exploitation. Vide si Odoo non configuré.
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
}
