import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooClientManager } from "@/modules/odoo/odoo-client-manager.service";

/**
 * Onglet Clients (Fabien 2026-05-14, image 29) — vue agrégée par
 * client de tout ce qui le concerne (parcelles, travaux). Un "client"
 * peut être :
 *
 * - Type `tenant` : une autre Exploitation Agri Qodo avec laquelle on
 *   a un PartnerLink ACTIVE — identifiant = UUID de l'Exploitation.
 * - Type `odoo` : un res.partner Odoo "seul" trouvé dans
 *   Travail.odooPartnerId ou Parcelle.odooPartnerId — identifiant =
 *   id Odoo.
 */
export type ClientType = "tenant" | "odoo";

export interface ClientSummary {
  type: ClientType;
  id: string;
  nom: string;
  canton: string | null;
  nbParcelles: number;
  nbTravaux: number;
  totalTravauxCHF: number;
}

export interface ClientDetail extends ClientSummary {
  numeroExploitant: string | null;
  emailContact: string | null;
  telephone: string | null;
  parcelles: Array<{
    id: string;
    nom: string;
    surfaceHa: number;
    cultureActuelle: string | null;
  }>;
  travaux: Array<{
    id: string;
    titre: string;
    date: string;
    statut: string;
    totalCHF: number;
    nbProduits: number;
    nbHeures: number;
  }>;
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odoo: OdooClientManager,
  ) {}

  /**
   * Liste agrégée de tous les clients pour l'exploitation courante.
   * Source 1 : PartnerLinks ACTIVE → Exploitations partenaires.
   * Source 2 : res.partner Odoo distincts trouvés dans Travail.
   */
  async list(): Promise<ClientSummary[]> {
    const { tenantId } = this.tenantContext.get();

    // 1. Partenaires Agri Qodo actifs
    const links = await this.prisma.partnerLink.findMany({
      where: { ownerTenantId: tenantId, status: "ACTIVE" },
      include: {
        partnerTenant: {
          select: { id: true, nom: true, canton: true },
        },
      },
    });

    const partnerSummaries: ClientSummary[] = await Promise.all(
      links.map(async (link) => {
        const [nbParcelles, travaux] = await Promise.all([
          this.prisma.parcelle.count({
            where: { tenantId: link.partnerTenantId },
          }),
          this.prisma.travail.findMany({
            where: { tenantId, partenaireId: link.partnerTenantId },
            include: {
              lignesProduit: { select: { quantite: true, prixUnitaireCHF: true } },
              lignesHeure: { select: { dureeMinutes: true, tauxHoraireCHF: true } },
            },
          }),
        ]);
        return {
          type: "tenant" as const,
          id: link.partnerTenantId,
          nom: link.partnerTenant.nom,
          canton: link.partnerTenant.canton,
          nbParcelles,
          nbTravaux: travaux.length,
          totalTravauxCHF: travaux.reduce((s, t) => s + this.totalTravailCHF(t), 0),
        };
      }),
    );

    // 2. Clients Odoo "seuls" (pas Exploitation AQ) — distincts dans
    // les Travaux où odooPartnerId est posé.
    const odooClientsAggreg = await this.prisma.travail.groupBy({
      by: ["odooPartnerId", "odooPartnerName"],
      where: {
        tenantId,
        odooPartnerId: { not: null },
        partenaireId: null, // pas un partenaire AQ
      },
      _count: { _all: true },
    });

    const odooSummaries: ClientSummary[] = await Promise.all(
      odooClientsAggreg.map(async (row) => {
        const odooId = row.odooPartnerId as number;
        const travaux = await this.prisma.travail.findMany({
          where: { tenantId, odooPartnerId: odooId },
          include: {
            lignesProduit: { select: { quantite: true, prixUnitaireCHF: true } },
            lignesHeure: { select: { dureeMinutes: true, tauxHoraireCHF: true } },
          },
        });
        const nbParcelles = await this.prisma.parcelle.count({
          where: { tenantId, odooPartnerId: odooId },
        });
        return {
          type: "odoo" as const,
          id: String(odooId),
          nom: row.odooPartnerName ?? `Client Odoo #${odooId}`,
          canton: null,
          nbParcelles,
          nbTravaux: travaux.length,
          totalTravauxCHF: travaux.reduce((s, t) => s + this.totalTravailCHF(t), 0),
        };
      }),
    );

    return [...partnerSummaries, ...odooSummaries].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }

  /**
   * Détail d'un client — infos + parcelles + travaux. `type` distingue
   * les Exploitations partenaires AQ des clients Odoo "seuls".
   */
  async get(type: ClientType, id: string): Promise<ClientDetail> {
    const { tenantId } = this.tenantContext.get();

    if (type === "tenant") {
      const link = await this.prisma.partnerLink.findFirst({
        where: { ownerTenantId: tenantId, partnerTenantId: id, status: "ACTIVE" },
        include: {
          partnerTenant: {
            select: {
              id: true,
              nom: true,
              canton: true,
              code: true,
              emailContact: true,
              telephone: true,
            },
          },
        },
      });
      if (!link) throw new NotFoundException("Client introuvable ou non partenaire actif.");

      const [parcelles, travaux] = await Promise.all([
        this.prisma.parcelle.findMany({
          where: { tenantId: id },
          select: { id: true, nom: true, surfaceM2: true, cultureActuelle: true },
          orderBy: { nom: "asc" },
        }),
        this.prisma.travail.findMany({
          where: { tenantId, partenaireId: id },
          include: {
            lignesProduit: { select: { quantite: true, prixUnitaireCHF: true } },
            lignesHeure: { select: { dureeMinutes: true, tauxHoraireCHF: true } },
          },
          orderBy: { date: "desc" },
        }),
      ]);

      return {
        type: "tenant",
        id: link.partnerTenantId,
        nom: link.partnerTenant.nom,
        canton: link.partnerTenant.canton,
        numeroExploitant: link.partnerTenant.code,
        emailContact: link.partnerTenant.emailContact,
        telephone: link.partnerTenant.telephone,
        nbParcelles: parcelles.length,
        nbTravaux: travaux.length,
        totalTravauxCHF: travaux.reduce((s, t) => s + this.totalTravailCHF(t), 0),
        parcelles: parcelles.map((p) => ({
          id: p.id,
          nom: p.nom,
          surfaceHa: Number(p.surfaceM2) / 10_000,
          cultureActuelle: p.cultureActuelle,
        })),
        travaux: travaux.map((t) => ({
          id: t.id,
          titre: t.titre,
          date: t.date.toISOString(),
          statut: t.statut,
          totalCHF: this.totalTravailCHF(t),
          nbProduits: t.lignesProduit.length,
          nbHeures: t.lignesHeure.length,
        })),
      };
    }

    // type === "odoo"
    const odooId = Number(id);
    if (!Number.isFinite(odooId)) {
      throw new NotFoundException("Identifiant client Odoo invalide.");
    }
    const [travaux, parcelles] = await Promise.all([
      this.prisma.travail.findMany({
        where: { tenantId, odooPartnerId: odooId },
        include: {
          lignesProduit: { select: { quantite: true, prixUnitaireCHF: true } },
          lignesHeure: { select: { dureeMinutes: true, tauxHoraireCHF: true } },
        },
        orderBy: { date: "desc" },
      }),
      this.prisma.parcelle.findMany({
        where: { tenantId, odooPartnerId: odooId },
        select: { id: true, nom: true, surfaceM2: true, cultureActuelle: true },
        orderBy: { nom: "asc" },
      }),
    ]);

    if (travaux.length === 0 && parcelles.length === 0) {
      throw new NotFoundException("Client introuvable.");
    }

    // Nom : prendre celui mémorisé sur n'importe quel Travail, sinon
    // fallback "Client Odoo #X".
    const nom = travaux.find((t) => t.odooPartnerName)?.odooPartnerName ?? `Client Odoo #${odooId}`;

    // Enrichissement Odoo best-effort (email, tel).
    let emailContact: string | null = null;
    let telephone: string | null = null;
    try {
      const client = await this.odoo.forTenant(tenantId);
      const rows = await client.searchRead<{
        id: number;
        email?: string | false;
        phone?: string | false;
      }>("res.partner", [["id", "=", odooId]], {
        fields: ["id", "email", "phone"],
        limit: 1,
      });
      const first = rows[0];
      if (first) {
        emailContact = typeof first.email === "string" ? first.email : null;
        telephone = typeof first.phone === "string" ? first.phone : null;
      }
    } catch (err) {
      this.logger.warn(
        `Enrichissement Odoo res.partner #${odooId} échoué : ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    return {
      type: "odoo",
      id: String(odooId),
      nom,
      canton: null,
      numeroExploitant: null,
      emailContact,
      telephone,
      nbParcelles: parcelles.length,
      nbTravaux: travaux.length,
      totalTravauxCHF: travaux.reduce((s, t) => s + this.totalTravailCHF(t), 0),
      parcelles: parcelles.map((p) => ({
        id: p.id,
        nom: p.nom,
        surfaceHa: Number(p.surfaceM2) / 10_000,
        cultureActuelle: p.cultureActuelle,
      })),
      travaux: travaux.map((t) => ({
        id: t.id,
        titre: t.titre,
        date: t.date.toISOString(),
        statut: t.statut,
        totalCHF: this.totalTravailCHF(t),
        nbProduits: t.lignesProduit.length,
        nbHeures: t.lignesHeure.length,
      })),
    };
  }

  private totalTravailCHF(t: {
    lignesProduit: Array<{ quantite: unknown; prixUnitaireCHF: unknown }>;
    lignesHeure: Array<{ dureeMinutes: number; tauxHoraireCHF: unknown }>;
  }): number {
    const totalProduits = t.lignesProduit.reduce((s, l) => {
      const qte = Number(l.quantite);
      const prix = l.prixUnitaireCHF != null ? Number(l.prixUnitaireCHF) : 0;
      return s + (Number.isFinite(qte) ? qte : 0) * (Number.isFinite(prix) ? prix : 0);
    }, 0);
    const totalHeures = t.lignesHeure.reduce((s, l) => {
      const taux = l.tauxHoraireCHF != null ? Number(l.tauxHoraireCHF) : 0;
      return s + (l.dureeMinutes / 60) * (Number.isFinite(taux) ? taux : 0);
    }, 0);
    return totalProduits + totalHeures;
  }
}
