import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InterventionType, type Prisma, ProduitCategorie, ValidationStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateInterventionDto } from "./dto/create-intervention.dto";
import type { UpdateInterventionDto } from "./dto/update-intervention.dto";

@Injectable()
export class InterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Liste les interventions visibles par le tenant courant.
   *
   * Une intervention est visible si :
   *   - elle appartient à mes parcelles (ownerTenantId = moi), OU
   *   - je l'ai saisie en tant que partenaire (authorTenantId = moi).
   *
   * Modèle non géré par l'extension Prisma tenant-aware (cf. ADR-002),
   * filtre manuel obligatoire.
   */
  list() {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.intervention.findMany({
      where: {
        OR: [{ ownerTenantId: tenantId }, { authorTenantId: tenantId }],
      },
      orderBy: { dateOperation: "desc" },
      take: 200,
      include: this.includeRelations,
    });
  }

  async getById(id: string) {
    const { tenantId } = this.tenantContext.get();
    const intervention = await this.prisma.intervention.findFirst({
      where: {
        id,
        OR: [{ ownerTenantId: tenantId }, { authorTenantId: tenantId }],
      },
      include: this.includeRelations,
    });
    if (!intervention) {
      throw new NotFoundException("Intervention introuvable");
    }
    return intervention;
  }

  private readonly includeRelations = {
    parcelle: { select: { id: true, nom: true } },
    produitRef: { select: { id: true, libelle: true, categorie: true, especeCode: true } },
    culture: { select: { id: true, espece: true, variete: true, campagne: true } },
  } satisfies Prisma.InterventionInclude;

  /**
   * Création :
   * - L'auteur (authorTenantId) = tenant courant.
   * - Le propriétaire (ownerTenantId) = tenant qui possède la parcelle.
   *   Pour MVP sans M16 actif, owner = author.
   * - validationStatus = SELF si owner == author, sinon PENDING (M16).
   *
   * On vérifie que la parcelle existe et qu'elle appartient soit au tenant
   * courant (cas standard), soit à un tenant pour lequel un PartnerLink
   * actif autorise la saisie (cas M16 — non implémenté pour l'instant ;
   * pour MVP, parcelle DOIT appartenir au tenant courant).
   */
  async create(dto: CreateInterventionDto) {
    const { tenantId } = this.tenantContext.get();

    const parcelle = await this.prisma.parcelle.findFirst({
      where: { id: dto.parcelleId, tenantId },
      select: { id: true, tenantId: true, surfaceM2: true },
    });
    if (!parcelle) {
      throw new ForbiddenException("Parcelle introuvable ou hors de votre exploitation");
    }

    // Si surface partielle saisie, on borne à la surface de la parcelle
    // (l'agriculteur ne peut pas travailler 2 ha sur une parcelle de 1 ha).
    if (
      dto.surfaceTravailleeM2 !== undefined &&
      dto.surfaceTravailleeM2 > Number(parcelle.surfaceM2)
    ) {
      throw new BadRequestException(
        `Surface travaillée (${dto.surfaceTravailleeM2} m²) supérieure à la surface de la parcelle (${Number(parcelle.surfaceM2)} m²)`,
      );
    }

    const ownerTenantId = parcelle.tenantId;
    const authorTenantId = tenantId;
    const validationStatus =
      ownerTenantId === authorTenantId ? ValidationStatus.SELF : ValidationStatus.PENDING;
    const dateOperation = new Date(dto.dateOperation);

    // Si produitId fourni, on vérifie qu'il existe (et qu'il est global ou
    // au tenant courant) et on capture libelle/especeCode pour les besoins
    // métier (SEMIS → Culture, FUMURE → bilan plus tard).
    const produit = dto.produitId
      ? await this.prisma.produit.findFirst({
          where: {
            id: dto.produitId,
            actif: true,
            OR: [{ tenantId: null }, { tenantId }],
          },
          select: { id: true, categorie: true, libelle: true, especeCode: true },
        })
      : null;
    if (dto.produitId && !produit) {
      throw new BadRequestException("Produit introuvable ou inactif");
    }

    // SEMIS = déclencheur de Culture. Carnet = source unique : pas de
    // saisie séparée. Le produit doit être une SEMENCE avec especeCode.
    return this.prisma.$transaction(async (tx) => {
      let cultureId: string | null = null;
      if (dto.type === InterventionType.SEMIS && produit) {
        if (produit.categorie !== ProduitCategorie.SEMENCE) {
          throw new BadRequestException(
            "Pour un SEMIS, le produit doit être une semence du catalogue",
          );
        }
        if (!produit.especeCode) {
          throw new BadRequestException(
            "La semence n'a pas de code espèce — impossible de créer la Culture",
          );
        }
        const created = await tx.culture.create({
          data: {
            tenantId: ownerTenantId,
            parcelleId: dto.parcelleId,
            espece: produit.especeCode,
            variete: produit.libelle,
            dateSemis: dateOperation,
            campagne: dateOperation.getUTCFullYear(),
          },
          select: { id: true },
        });
        cultureId = created.id;
      }

      return tx.intervention.create({
        data: {
          clientUuid: dto.clientUuid ?? randomUUID(),
          parcelleId: dto.parcelleId,
          ownerTenantId,
          authorTenantId,
          type: dto.type,
          dateOperation,
          produitId: produit?.id ?? null,
          produit: dto.produit ?? produit?.libelle ?? null,
          quantite: dto.quantite ?? null,
          unite: dto.unite ?? null,
          surfaceTravailleeM2: dto.surfaceTravailleeM2 ?? null,
          notes: dto.notes ?? null,
          techniqueEpandage: dto.techniqueEpandage ?? null,
          cultureId,
          validationStatus,
        },
        include: this.includeRelations,
      });
    });
  }

  /**
   * Update : seul le propriétaire (ownerTenantId) peut modifier.
   * (M16 v2 : permettre à l'auteur de modifier tant que validationStatus
   * = PENDING ; pour l'instant, owner uniquement.)
   */
  async update(id: string, dto: UpdateInterventionDto) {
    const { tenantId } = this.tenantContext.get();

    // Si l'intervention a une Culture associée (SEMIS) et qu'on modifie la
    // date, on synchronise dateSemis + campagne sur la Culture pour garder
    // le bilan cohérent.
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.intervention.findFirst({
        where: { id, ownerTenantId: tenantId },
        select: { id: true, cultureId: true, dateOperation: true },
      });
      if (!existing) {
        throw new NotFoundException("Intervention introuvable");
      }

      const newDate = dto.dateOperation ? new Date(dto.dateOperation) : null;

      await tx.intervention.update({
        where: { id },
        data: {
          ...(newDate !== null ? { dateOperation: newDate } : {}),
          ...(dto.produit !== undefined ? { produit: dto.produit } : {}),
          ...(dto.quantite !== undefined ? { quantite: dto.quantite } : {}),
          ...(dto.unite !== undefined ? { unite: dto.unite } : {}),
          ...(dto.surfaceTravailleeM2 !== undefined
            ? { surfaceTravailleeM2: dto.surfaceTravailleeM2 }
            : {}),
          ...(dto.techniqueEpandage !== undefined
            ? { techniqueEpandage: dto.techniqueEpandage }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      if (existing.cultureId && newDate) {
        await tx.culture.update({
          where: { id: existing.cultureId },
          data: { dateSemis: newDate, campagne: newDate.getUTCFullYear() },
        });
      }

      return tx.intervention.findUniqueOrThrow({
        where: { id },
        include: this.includeRelations,
      });
    });
  }

  /**
   * Supprime l'intervention. Si elle avait généré une Culture (SEMIS),
   * la Culture est aussi supprimée pour éviter d'orpheliner le bilan
   * — l'intervention était la source unique de cette Culture.
   */
  async remove(id: string) {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.intervention.findFirst({
        where: { id, ownerTenantId: tenantId },
        select: { id: true, cultureId: true },
      });
      if (!existing) {
        throw new NotFoundException("Intervention introuvable");
      }
      await tx.intervention.delete({ where: { id } });
      if (existing.cultureId) {
        await tx.culture.delete({ where: { id: existing.cultureId } }).catch(() => {
          // Culture déjà supprimée (cascade parcelle ?) — non bloquant
        });
      }
    });
  }
}
