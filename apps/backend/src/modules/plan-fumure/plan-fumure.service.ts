import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InterventionType, type Prisma, ValidationStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreatePlanApportDto } from "./dto/create-plan-apport.dto";
import type { UpdatePlanApportDto } from "./dto/update-plan-apport.dto";

@Injectable()
export class PlanFumureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private readonly include = {
    parcelle: { select: { id: true, nom: true } },
    produitRef: { select: { id: true, libelle: true, tauxN: true, tauxP: true, categorie: true } },
    intervention: {
      select: {
        id: true,
        type: true,
        dateOperation: true,
        quantite: true,
        techniqueEpandage: true,
      },
    },
  } satisfies Prisma.PlanApportInclude;

  list(filter: { campagne?: number; parcelleId?: string } = {}) {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.planApport.findMany({
      where: {
        tenantId,
        ...(filter.campagne ? { campagne: filter.campagne } : {}),
        ...(filter.parcelleId ? { parcelleId: filter.parcelleId } : {}),
      },
      orderBy: [{ datePrevue: "asc" }, { createdAt: "asc" }],
      include: this.include,
    });
  }

  async getById(id: string) {
    const { tenantId } = this.tenantContext.get();
    const plan = await this.prisma.planApport.findFirst({
      where: { id, tenantId },
      include: this.include,
    });
    if (!plan) throw new NotFoundException("Plan d'apport introuvable");
    return plan;
  }

  async create(dto: CreatePlanApportDto) {
    const { tenantId } = this.tenantContext.get();

    // Vérifie parcelle appartient au tenant
    const parcelle = await this.prisma.parcelle.findFirst({
      where: { id: dto.parcelleId, tenantId },
      select: { id: true },
    });
    if (!parcelle) {
      throw new ForbiddenException("Parcelle introuvable ou hors de votre exploitation");
    }

    // Si produitId fourni, on calcule kgN/kgP automatiquement (sauf si saisie explicite)
    let kgNPrevu = dto.kgNPrevu;
    let kgPPrevu = dto.kgPPrevu;
    if (dto.produitId) {
      const produit = await this.prisma.produit.findFirst({
        where: { id: dto.produitId, OR: [{ tenantId: null }, { tenantId }] },
        select: { tauxN: true, tauxP: true },
      });
      if (!produit) throw new BadRequestException("Produit introuvable");
      if (dto.quantitePrevue !== undefined) {
        if (kgNPrevu === undefined && produit.tauxN) {
          kgNPrevu = (Number(dto.quantitePrevue) * Number(produit.tauxN)) / 100;
        }
        if (kgPPrevu === undefined && produit.tauxP) {
          kgPPrevu = (Number(dto.quantitePrevue) * Number(produit.tauxP)) / 100;
        }
      }
    }

    return this.prisma.planApport.create({
      data: {
        tenantId,
        parcelleId: dto.parcelleId,
        campagne: dto.campagne,
        datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : null,
        produitId: dto.produitId ?? null,
        produitLibre: dto.produitLibre ?? null,
        quantitePrevue: dto.quantitePrevue ?? null,
        unite: dto.unite ?? null,
        kgNPrevu: kgNPrevu ?? null,
        kgPPrevu: kgPPrevu ?? null,
        technique: dto.technique ?? null,
        notes: dto.notes ?? null,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdatePlanApportDto) {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.planApport.findFirst({
      where: { id, tenantId },
      select: { id: true, interventionId: true },
    });
    if (!existing) throw new NotFoundException("Plan d'apport introuvable");
    if (existing.interventionId) {
      throw new BadRequestException(
        "Ce plan a déjà été réalisé — modifie l'intervention liée plutôt que le plan",
      );
    }

    await this.prisma.planApport.update({
      where: { id },
      data: {
        ...(dto.datePrevue !== undefined
          ? { datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : null }
          : {}),
        ...(dto.produitId !== undefined ? { produitId: dto.produitId ?? null } : {}),
        ...(dto.produitLibre !== undefined ? { produitLibre: dto.produitLibre ?? null } : {}),
        ...(dto.quantitePrevue !== undefined ? { quantitePrevue: dto.quantitePrevue ?? null } : {}),
        ...(dto.unite !== undefined ? { unite: dto.unite ?? null } : {}),
        ...(dto.kgNPrevu !== undefined ? { kgNPrevu: dto.kgNPrevu ?? null } : {}),
        ...(dto.kgPPrevu !== undefined ? { kgPPrevu: dto.kgPPrevu ?? null } : {}),
        ...(dto.technique !== undefined ? { technique: dto.technique ?? null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes ?? null } : {}),
      },
    });
    return this.getById(id);
  }

  async remove(id: string) {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.planApport.findFirst({
      where: { id, tenantId },
      select: { id: true, interventionId: true },
    });
    if (!existing) throw new NotFoundException("Plan d'apport introuvable");
    if (existing.interventionId) {
      throw new BadRequestException(
        "Ce plan a été réalisé — supprime d'abord l'intervention si tu veux annuler",
      );
    }
    await this.prisma.planApport.delete({ where: { id } });
  }

  /**
   * Réalise un plan : crée une Intervention FUMURE (organique ou minérale
   * selon la catégorie du produit) liée au plan. Les valeurs réelles
   * (date, quantité, technique) peuvent différer du prévisionnel — c'est
   * justement le sens du "réalisé vs prévu".
   */
  async realiser(
    id: string,
    overrides: {
      dateOperation?: string;
      quantite?: number;
      technique?: import("@prisma/client").TechniqueEpandage;
    } = {},
  ) {
    const { tenantId } = this.tenantContext.get();
    const plan = await this.prisma.planApport.findFirst({
      where: { id, tenantId },
      include: { produitRef: { select: { id: true, categorie: true, libelle: true } } },
    });
    if (!plan) throw new NotFoundException("Plan d'apport introuvable");
    if (plan.interventionId) {
      throw new BadRequestException("Ce plan a déjà été réalisé");
    }

    // Détermine le type d'intervention selon la catégorie du produit.
    const type =
      plan.produitRef?.categorie === "ENGRAIS_ORGANIQUE"
        ? InterventionType.FUMURE_ORGANIQUE
        : InterventionType.FUMURE_MINERALE;

    const date = overrides.dateOperation
      ? new Date(overrides.dateOperation)
      : (plan.datePrevue ?? new Date());
    const quantite =
      overrides.quantite ?? (plan.quantitePrevue ? Number(plan.quantitePrevue) : null);
    const technique = overrides.technique ?? plan.technique;

    return this.prisma.$transaction(async (tx) => {
      const intervention = await tx.intervention.create({
        data: {
          clientUuid: randomUUID(),
          parcelleId: plan.parcelleId,
          ownerTenantId: tenantId,
          authorTenantId: tenantId,
          type,
          dateOperation: date,
          produitId: plan.produitId,
          produit: plan.produitRef?.libelle ?? plan.produitLibre ?? null,
          quantite,
          unite: plan.unite,
          techniqueEpandage: technique,
          notes: plan.notes
            ? `Réalisé depuis plan : ${plan.notes}`
            : "Réalisé depuis le plan de fumure",
          validationStatus: ValidationStatus.SELF,
        },
      });
      await tx.planApport.update({
        where: { id },
        data: { interventionId: intervention.id },
      });
      return tx.planApport.findUniqueOrThrow({ where: { id }, include: this.include });
    });
  }
}
