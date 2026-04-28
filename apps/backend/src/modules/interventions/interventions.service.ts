import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ValidationStatus } from "@prisma/client";
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
      include: { parcelle: { select: { id: true, nom: true } } },
    });
  }

  async getById(id: string) {
    const { tenantId } = this.tenantContext.get();
    const intervention = await this.prisma.intervention.findFirst({
      where: {
        id,
        OR: [{ ownerTenantId: tenantId }, { authorTenantId: tenantId }],
      },
      include: { parcelle: { select: { id: true, nom: true } } },
    });
    if (!intervention) {
      throw new NotFoundException("Intervention introuvable");
    }
    return intervention;
  }

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
      select: { id: true, tenantId: true },
    });
    if (!parcelle) {
      throw new ForbiddenException("Parcelle introuvable ou hors de votre exploitation");
    }

    const ownerTenantId = parcelle.tenantId;
    const authorTenantId = tenantId;
    const validationStatus =
      ownerTenantId === authorTenantId ? ValidationStatus.SELF : ValidationStatus.PENDING;

    return this.prisma.intervention.create({
      data: {
        clientUuid: dto.clientUuid ?? randomUUID(),
        parcelleId: dto.parcelleId,
        ownerTenantId,
        authorTenantId,
        type: dto.type,
        dateOperation: new Date(dto.dateOperation),
        produit: dto.produit ?? null,
        quantite: dto.quantite ?? null,
        unite: dto.unite ?? null,
        notes: dto.notes ?? null,
        validationStatus,
      },
      include: { parcelle: { select: { id: true, nom: true } } },
    });
  }

  /**
   * Update : seul le propriétaire (ownerTenantId) peut modifier.
   * (M16 v2 : permettre à l'auteur de modifier tant que validationStatus
   * = PENDING ; pour l'instant, owner uniquement.)
   */
  async update(id: string, dto: UpdateInterventionDto) {
    const { tenantId } = this.tenantContext.get();
    const result = await this.prisma.intervention.updateMany({
      where: { id, ownerTenantId: tenantId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.dateOperation !== undefined ? { dateOperation: new Date(dto.dateOperation) } : {}),
        ...(dto.produit !== undefined ? { produit: dto.produit } : {}),
        ...(dto.quantite !== undefined ? { quantite: dto.quantite } : {}),
        ...(dto.unite !== undefined ? { unite: dto.unite } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    if (result.count === 0) {
      throw new NotFoundException("Intervention introuvable");
    }
    return this.getById(id);
  }

  async remove(id: string) {
    const { tenantId } = this.tenantContext.get();
    const result = await this.prisma.intervention.deleteMany({
      where: { id, ownerTenantId: tenantId },
    });
    if (result.count === 0) {
      throw new NotFoundException("Intervention introuvable");
    }
  }
}
