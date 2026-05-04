import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Canton, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { UpdateTenantDto } from "./dto/update-tenant.dto";

export interface AccessibleTenant {
  id: string;
  nom: string;
  code: string;
  canton: string;
  /** "home" : tenant accessible via compte fédéré (email+password commun). */
  kind: "home";
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère l'exploitation associée au tenant courant.
   */
  async getMine(tenantId: string) {
    const tenant = await this.prisma.exploitation.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException("Exploitation introuvable");
    }
    return tenant;
  }

  /**
   * Édition de l'exploitation par son owner. Le `numeroExploitant` mappe
   * sur la colonne `code` (unique global) — clé d'identification du
   * tenant pour le login et les liens partenaires.
   */
  async updateMine(tenantId: string, dto: UpdateTenantDto) {
    const data: Prisma.ExploitationUpdateInput = {};
    if (dto.numeroExploitant !== undefined) {
      data.code = dto.numeroExploitant.trim().toUpperCase();
    }
    if (dto.nom !== undefined) data.nom = dto.nom.trim();
    if (dto.numeroUfam !== undefined) data.numeroUfam = dto.numeroUfam.trim() || null;
    if (dto.numeroBdta !== undefined) data.numeroBdta = dto.numeroBdta.trim() || null;
    if (dto.visibleInDirectory !== undefined) data.visibleInDirectory = dto.visibleInDirectory;
    if (dto.noterTempsParProjet !== undefined) data.noterTempsParProjet = dto.noterTempsParProjet;
    if (dto.defaultProjetTravauxTiersId !== undefined) {
      // Validation : le projet doit appartenir au tenant courant.
      if (dto.defaultProjetTravauxTiersId) {
        const projet = await this.prisma.projet.findFirst({
          where: { id: dto.defaultProjetTravauxTiersId, tenantId },
          select: { id: true },
        });
        if (!projet) {
          throw new NotFoundException("Projet par défaut introuvable dans ton exploitation.");
        }
      }
      data.defaultProjetTravauxTiers = dto.defaultProjetTravauxTiersId
        ? { connect: { id: dto.defaultProjetTravauxTiersId } }
        : { disconnect: true };
    }
    if (Object.keys(data).length === 0) return this.getMine(tenantId);
    try {
      return await this.prisma.exploitation.update({ where: { id: tenantId }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Ce numéro d'exploitant est déjà utilisé");
      }
      throw err;
    }
  }

  /**
   * Liste les tenants accessibles via compte fédéré : tous les tenants
   * où l'utilisateur a un User avec le même email + password (la liste
   * a été calculée au login et figée dans `tenantIds` du JWT). On ne
   * retourne PAS les partenariats actifs : un PartnerLink autorise la
   * saisie d'interventions sur les parcelles d'un client (cf module
   * Prestations), pas la bascule de session.
   */
  async listAccessible(tenantIds: readonly string[]): Promise<AccessibleTenant[]> {
    if (tenantIds.length === 0) return [];
    const tenants = await this.prisma.exploitation.findMany({
      where: { id: { in: [...tenantIds] } },
      select: { id: true, nom: true, code: true, canton: true },
    });
    return tenants.map((t) => ({ ...t, kind: "home" as const }));
  }

  /**
   * Génère un code Agri Qodo unique : `AQ-{canton}-{ufam ou seq}-{token4}`.
   * Voir spec §6.
   */
  generateCode(canton: Canton, numeroUfam?: string | null): string {
    const ufamPart = numeroUfam ?? randomBytes(2).toString("hex").toUpperCase();
    const token = randomBytes(2).toString("hex").toUpperCase();
    return `AQ-${canton}-${ufamPart}-${token}`;
  }
}
