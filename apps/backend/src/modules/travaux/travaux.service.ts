import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type Prisma, TravailStatut } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type {
  CreateLigneHeureDto,
  CreateLigneProduitDto,
  CreateTravailDto,
} from "./dto/create-travail.dto";
import type { UpdateTravailDto } from "./dto/update-travail.dto";

@Injectable()
export class TravauxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private readonly include = {
    partenaire: { select: { id: true, nom: true, code: true, canton: true } },
    parcelle: { select: { id: true, nom: true } },
    lignesProduit: {
      orderBy: { createdAt: "asc" as const },
      include: {
        produit: { select: { id: true, libelle: true, unite: true, especeCode: true } },
      },
    },
    lignesHeure: {
      orderBy: { createdAt: "asc" as const },
      include: {
        user: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    },
  } satisfies Prisma.TravailInclude;

  async list() {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.travail.findMany({
      where: { tenantId },
      include: this.include,
      orderBy: { date: "desc" },
      take: 200,
    });
  }

  async getById(id: string) {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      include: this.include,
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    return travail;
  }

  async create(dto: CreateTravailDto) {
    const { tenantId } = this.tenantContext.get();
    await this.assertParcelle(dto.parcelleId, tenantId);
    await this.assertPartenaire(dto.partenaireId, tenantId);
    await this.assertLignesValid(dto.lignesProduit, dto.lignesHeure, tenantId);

    return this.prisma.travail.create({
      data: {
        tenantId,
        titre: dto.titre.trim(),
        date: new Date(dto.date),
        statut: TravailStatut.DRAFT,
        ...(dto.dateDebut ? { dateDebut: new Date(dto.dateDebut) } : {}),
        ...(dto.dateFin ? { dateFin: new Date(dto.dateFin) } : {}),
        ...(dto.partenaireId ? { partenaireId: dto.partenaireId } : {}),
        ...(dto.parcelleId ? { parcelleId: dto.parcelleId } : {}),
        ...(dto.notes ? { notes: dto.notes } : {}),
        ...(dto.lignesProduit && dto.lignesProduit.length > 0
          ? { lignesProduit: { create: dto.lignesProduit.map((l) => this.toLigneProduitData(l)) } }
          : {}),
        ...(dto.lignesHeure && dto.lignesHeure.length > 0
          ? { lignesHeure: { create: dto.lignesHeure.map((l) => this.toLigneHeureData(l)) } }
          : {}),
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateTravailDto) {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true },
    });
    if (!existing) throw new NotFoundException("Travail introuvable");
    if (existing.statut === TravailStatut.INVOICED) {
      throw new ConflictException(
        "Travail déjà facturé Odoo — modification interdite. Annule la facture côté Odoo d'abord.",
      );
    }
    if (dto.parcelleId) await this.assertParcelle(dto.parcelleId, tenantId);
    if (dto.partenaireId) await this.assertPartenaire(dto.partenaireId, tenantId);
    await this.assertLignesValid(dto.lignesProduit, dto.lignesHeure, tenantId);

    return this.prisma.$transaction(async (tx) => {
      // Stratégie "remplace tout" sur les lignes — plus simple côté UI
      // mobile (l'édition d'une ligne fait un PATCH avec la liste complète).
      if (dto.lignesProduit !== undefined) {
        await tx.ligneTravailProduit.deleteMany({ where: { travailId: id } });
        if (dto.lignesProduit.length > 0) {
          await tx.ligneTravailProduit.createMany({
            data: dto.lignesProduit.map((l) => ({ travailId: id, ...this.toLigneProduitData(l) })),
          });
        }
      }
      if (dto.lignesHeure !== undefined) {
        await tx.ligneTravailHeure.deleteMany({ where: { travailId: id } });
        if (dto.lignesHeure.length > 0) {
          await tx.ligneTravailHeure.createMany({
            data: dto.lignesHeure.map((l) => ({ travailId: id, ...this.toLigneHeureData(l) })),
          });
        }
      }

      const data: Prisma.TravailUpdateInput = {};
      if (dto.titre !== undefined) data.titre = dto.titre.trim();
      if (dto.date !== undefined) data.date = new Date(dto.date);
      if (dto.dateDebut !== undefined)
        data.dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : null;
      if (dto.dateFin !== undefined) data.dateFin = dto.dateFin ? new Date(dto.dateFin) : null;
      if (dto.notes !== undefined) data.notes = dto.notes || null;
      if (dto.partenaireId !== undefined) {
        data.partenaire = dto.partenaireId
          ? { connect: { id: dto.partenaireId } }
          : { disconnect: true };
      }
      if (dto.parcelleId !== undefined) {
        data.parcelle = dto.parcelleId ? { connect: { id: dto.parcelleId } } : { disconnect: true };
      }

      await tx.travail.update({ where: { id }, data });
      return tx.travail.findUniqueOrThrow({ where: { id }, include: this.include });
    });
  }

  async validate(id: string) {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.statut !== TravailStatut.DRAFT) {
      throw new ConflictException("Le travail n'est pas en brouillon — impossible de valider.");
    }
    await this.prisma.travail.update({
      where: { id },
      data: { statut: TravailStatut.VALIDATED },
    });
    return this.getById(id);
  }

  async cancel(id: string) {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.statut === TravailStatut.INVOICED) {
      throw new ConflictException(
        "Travail déjà facturé Odoo — annule la facture côté Odoo d'abord.",
      );
    }
    await this.prisma.travail.update({
      where: { id },
      data: { statut: TravailStatut.CANCELLED },
    });
    return this.getById(id);
  }

  async remove(id: string) {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.statut === TravailStatut.INVOICED) {
      throw new ConflictException("Travail déjà facturé — suppression interdite.");
    }
    await this.prisma.travail.delete({ where: { id } });
  }

  // ---- helpers ---------------------------------------------------------

  private toLigneProduitData(l: CreateLigneProduitDto) {
    return {
      libelle: l.libelle,
      quantite: l.quantite,
      unite: l.unite ?? "kg",
      ...(l.produitId ? { produitId: l.produitId } : {}),
      ...(l.prixUnitaireCHF !== undefined ? { prixUnitaireCHF: l.prixUnitaireCHF } : {}),
      ...(l.notes ? { notes: l.notes } : {}),
    };
  }

  private toLigneHeureData(l: CreateLigneHeureDto) {
    return {
      userId: l.userId,
      dureeMinutes: l.dureeMinutes,
      ...(l.tauxHoraireCHF !== undefined ? { tauxHoraireCHF: l.tauxHoraireCHF } : {}),
      ...(l.notes ? { notes: l.notes } : {}),
    };
  }

  private async assertParcelle(parcelleId: string | undefined, tenantId: string) {
    if (!parcelleId) return;
    const p = await this.prisma.parcelle.findFirst({
      where: { id: parcelleId, tenantId },
      select: { id: true },
    });
    if (!p) throw new ForbiddenException("Parcelle introuvable ou hors de votre exploitation");
  }

  private async assertPartenaire(partenaireId: string | undefined, _tenantId: string) {
    if (!partenaireId) return;
    const p = await this.prisma.exploitation.findUnique({
      where: { id: partenaireId },
      select: { id: true },
    });
    if (!p) throw new BadRequestException("Partenaire introuvable");
  }

  private async assertLignesValid(
    produits: CreateLigneProduitDto[] | undefined,
    heures: CreateLigneHeureDto[] | undefined,
    tenantId: string,
  ) {
    // produitId : doit exister + appartenir au tenant courant ou être global.
    const produitIds = (produits ?? []).flatMap((l) => (l.produitId ? [l.produitId] : []));
    if (produitIds.length > 0) {
      const found = await this.prisma.produit.findMany({
        where: { id: { in: produitIds }, OR: [{ tenantId: null }, { tenantId }] },
        select: { id: true },
      });
      if (found.length !== new Set(produitIds).size) {
        throw new BadRequestException("Une ligne produit référence un produit inconnu ou inactif.");
      }
    }
    // userId : doit appartenir au tenant courant.
    const userIds = (heures ?? []).map((l) => l.userId);
    if (userIds.length > 0) {
      const found = await this.prisma.user.findMany({
        where: { id: { in: userIds }, tenantId },
        select: { id: true },
      });
      if (found.length !== new Set(userIds).size) {
        throw new BadRequestException(
          "Une ligne heure référence un utilisateur hors exploitation.",
        );
      }
    }
  }
}
