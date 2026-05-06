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
import { AuditService } from "@/modules/audit/audit.service";
import type {
  CreateLigneHeureDto,
  CreateLigneProduitDto,
  CreateTravailDto,
} from "./dto/create-travail.dto";
import { OdooPushService } from "./odoo-push.service";
import type { UpdateTravailDto } from "./dto/update-travail.dto";

@Injectable()
export class TravauxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooPush: OdooPushService,
    private readonly audit: AuditService,
  ) {}

  private readonly include = {
    partenaire: { select: { id: true, nom: true, code: true, canton: true } },
    parcelle: { select: { id: true, nom: true } },
    projet: { select: { id: true, nom: true, type: true, couleurHex: true } },
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

  /**
   * Heures saisies par l'utilisateur courant — agrège ses
   * `LigneTravailHeure` à travers tous les Travaux du tenant. Filtres
   * date pour une semaine ou un mois précis.
   *
   * Renvoie les lignes avec le contexte du Travail parent (titre, date,
   * client, statut) — utile pour la vue timesheet personnelle.
   */
  async mesHeures(filters?: { dateDebut?: string; dateFin?: string }) {
    const ctx = this.tenantContext.get();
    const travailWhere: Prisma.TravailWhereInput = { tenantId: ctx.tenantId };
    if (filters?.dateDebut || filters?.dateFin) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (filters.dateDebut) dateFilter.gte = new Date(filters.dateDebut);
      if (filters.dateFin) dateFilter.lte = new Date(filters.dateFin);
      travailWhere.date = dateFilter;
    }
    return this.prisma.ligneTravailHeure.findMany({
      where: {
        userId: ctx.userId,
        travail: travailWhere,
      },
      include: {
        travail: {
          select: {
            id: true,
            titre: true,
            date: true,
            statut: true,
            partenaire: { select: { id: true, nom: true } },
            parcelle: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: [{ travail: { date: "desc" } }, { createdAt: "asc" }],
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
    await this.assertProjet(dto.projetId, tenantId);
    await this.assertLignesValid(dto.lignesProduit, dto.lignesHeure, tenantId);

    // Sprint 2 fusion-interventions — Planning. Un travail créé sans
    // contenu (pas de lignes) avec une datePrevue est considéré comme
    // "PLANIFIE". Sinon par défaut DRAFT comme avant.
    const isPlanningOnly =
      !!dto.datePrevue &&
      (!dto.lignesProduit || dto.lignesProduit.length === 0) &&
      (!dto.lignesHeure || dto.lignesHeure.length === 0);

    const created = await this.prisma.travail.create({
      data: {
        tenantId,
        titre: dto.titre.trim(),
        date: new Date(dto.date),
        statut: isPlanningOnly ? TravailStatut.PLANIFIE : TravailStatut.DRAFT,
        ...(dto.interne !== undefined ? { interne: dto.interne } : {}),
        ...(dto.dateDebut ? { dateDebut: new Date(dto.dateDebut) } : {}),
        ...(dto.dateFin ? { dateFin: new Date(dto.dateFin) } : {}),
        ...(dto.partenaireId ? { partenaireId: dto.partenaireId } : {}),
        ...(dto.odooPartnerId !== undefined ? { odooPartnerId: dto.odooPartnerId } : {}),
        ...(dto.parcelleId ? { parcelleId: dto.parcelleId } : {}),
        ...(dto.projetId ? { projetId: dto.projetId } : {}),
        ...(dto.notes ? { notes: dto.notes } : {}),
        // datePrevue par défaut = date pour que tous les travaux
        // apparaissent dans /planning (cf interventions.service).
        datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : new Date(dto.date),
        ...(dto.assignedToUserId ? { assignedToUserId: dto.assignedToUserId } : {}),
        ...(dto.lignesProduit && dto.lignesProduit.length > 0
          ? { lignesProduit: { create: dto.lignesProduit.map((l) => this.toLigneProduitData(l)) } }
          : {}),
        ...(dto.lignesHeure && dto.lignesHeure.length > 0
          ? { lignesHeure: { create: dto.lignesHeure.map((l) => this.toLigneHeureData(l)) } }
          : {}),
      },
      include: this.include,
    });

    // Push Odoo automatique en best-effort (review 2026-05-04 : "je veux
    // que le pousser vers odoo soit automatique"). Ne bloque jamais la
    // création si Odoo down ou non configuré — l'utilisateur pourra
    // re-pousser manuellement depuis la fiche détail.
    // Skip si pas de lignes (pushTravail rejetterait avec
    // BadRequestException "travail vide") — laisse l'utilisateur ajouter
    // des lignes puis re-pousser.
    const hasContent = created.lignesProduit.length > 0 || created.lignesHeure.length > 0;
    if (hasContent) {
      this.odooPush.tryPushTravailQuotation(created.id).catch(() => undefined); // already swallowed inside, mais ceinture+bretelles
    }

    return created;
  }

  async update(id: string, dto: UpdateTravailDto) {
    const { tenantId } = this.tenantContext.get();
    // Capture le before pour l'audit log — uniquement les champs scalaires
    // touchables. Les lignes (produits/heures) sont remplacées en bloc et
    // tracées séparément via leur compteur.
    const existing = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        statut: true,
        titre: true,
        date: true,
        interne: true,
        dateDebut: true,
        dateFin: true,
        notes: true,
        partenaireId: true,
        parcelleId: true,
        lignesProduit: { select: { id: true } },
        lignesHeure: { select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundException("Travail introuvable");
    if (existing.statut === TravailStatut.INVOICED) {
      throw new ConflictException(
        "Travail déjà facturé Odoo — modification interdite. Annule la facture côté Odoo d'abord.",
      );
    }
    if (dto.parcelleId) await this.assertParcelle(dto.parcelleId, tenantId);
    if (dto.partenaireId) await this.assertPartenaire(dto.partenaireId, tenantId);
    if (dto.projetId) await this.assertProjet(dto.projetId, tenantId);
    await this.assertLignesValid(dto.lignesProduit, dto.lignesHeure, tenantId);

    return this.prisma
      .$transaction(async (tx) => {
        // Stratégie "remplace tout" sur les lignes — plus simple côté UI
        // mobile (l'édition d'une ligne fait un PATCH avec la liste complète).
        if (dto.lignesProduit !== undefined) {
          await tx.ligneTravailProduit.deleteMany({ where: { travailId: id } });
          if (dto.lignesProduit.length > 0) {
            await tx.ligneTravailProduit.createMany({
              data: dto.lignesProduit.map((l) => ({
                travailId: id,
                ...this.toLigneProduitData(l),
              })),
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
        if (dto.interne !== undefined) data.interne = dto.interne;
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
          data.parcelle = dto.parcelleId
            ? { connect: { id: dto.parcelleId } }
            : { disconnect: true };
        }
        if (dto.projetId !== undefined) {
          data.projet = dto.projetId ? { connect: { id: dto.projetId } } : { disconnect: true };
        }

        await tx.travail.update({ where: { id }, data });
        return tx.travail.findUniqueOrThrow({ where: { id }, include: this.include });
      })
      .then(async (updated) => {
        // Best-effort audit : on ne wrap pas dans la transaction pour ne pas
        // bloquer l'update si l'insert audit échoue (le service le swallow).
        const before: Record<string, unknown> = {
          titre: existing.titre,
          date: existing.date,
          interne: existing.interne,
          dateDebut: existing.dateDebut,
          dateFin: existing.dateFin,
          notes: existing.notes,
          partenaireId: existing.partenaireId,
          parcelleId: existing.parcelleId,
          lignesProduitCount: existing.lignesProduit.length,
          lignesHeureCount: existing.lignesHeure.length,
        };
        const after: Record<string, unknown> = {
          titre: updated.titre,
          date: updated.date,
          interne: updated.interne,
          dateDebut: updated.dateDebut,
          dateFin: updated.dateFin,
          notes: updated.notes,
          partenaireId: updated.partenaireId,
          parcelleId: updated.parcelleId,
          lignesProduitCount: updated.lignesProduit.length,
          lignesHeureCount: updated.lignesHeure.length,
        };
        await this.audit.recordEdit({
          entityType: "Travail",
          entityId: id,
          action: "UPDATE",
          before,
          after,
        });

        // Push Odoo automatique si le travail n'a pas encore été poussé
        // et qu'il a des lignes maintenant (review 2026-05-04). Ne touche
        // pas aux travaux déjà poussés (sale.order ou project.task) pour
        // éviter les doublons côté Odoo.
        const alreadyPushed = !!updated.odooSaleOrderId || !!updated.odooTaskId;
        const hasContent = updated.lignesProduit.length > 0 || updated.lignesHeure.length > 0;
        if (!alreadyPushed && hasContent) {
          this.odooPush.tryPushTravailQuotation(id).catch(() => undefined);
        }
        return updated;
      });
  }

  async validate(id: string) {
    const { tenantId } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true, odooSaleOrderId: true },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.statut !== TravailStatut.DRAFT) {
      throw new ConflictException("Le travail n'est pas en brouillon — impossible de valider.");
    }
    await this.prisma.travail.update({
      where: { id },
      data: { statut: TravailStatut.VALIDATED },
    });

    // Si le devis Odoo a été créé (cas B auto ou push manuel), on
    // confirme côté Odoo pour transformer le devis en commande client
    // (state='draft' → 'sale'). Best-effort : un échec Odoo ne bloque
    // pas la validation locale.
    if (travail.odooSaleOrderId) {
      await this.odooPush.tryConfirmSaleOrder(id);
    }

    return this.getById(id);
  }

  /**
   * Sprint 2 fusion-interventions — Planning. Marque un travail PLANIFIE
   * comme terminé. Selon le rôle de l'utilisateur :
   * - OWNER → passe directement en VALIDATED (prêt à facturer Odoo).
   * - EMPLOYE → passe en PENDING_REVIEW (attente validation OWNER).
   */
  async markCompleted(id: string) {
    const { tenantId, role } = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id, tenantId },
      select: { id: true, statut: true },
    });
    if (!travail) throw new NotFoundException("Travail introuvable");
    if (travail.statut !== TravailStatut.PLANIFIE && travail.statut !== TravailStatut.DRAFT) {
      throw new ConflictException(
        "Le travail n'est pas planifié ni en brouillon — impossible de marquer comme terminé.",
      );
    }
    const nextStatut = role === "OWNER" ? TravailStatut.VALIDATED : TravailStatut.PENDING_REVIEW;
    await this.prisma.travail.update({
      where: { id },
      data: { statut: nextStatut },
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
    // Si heureDebut + heureFin fournies, on recalcule la durée pour rester
    // cohérent (l'UI peut envoyer les deux mais c'est le serveur qui décide).
    let dureeMinutes = l.dureeMinutes;
    if (l.heureDebut && l.heureFin) {
      const start = new Date(l.heureDebut).getTime();
      const end = new Date(l.heureFin).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        dureeMinutes = Math.round((end - start) / 60000);
      }
    }
    return {
      userId: l.userId,
      dureeMinutes,
      ...(l.heureDebut ? { heureDebut: new Date(l.heureDebut) } : {}),
      ...(l.heureFin ? { heureFin: new Date(l.heureFin) } : {}),
      ...(l.tauxHoraireCHF !== undefined ? { tauxHoraireCHF: l.tauxHoraireCHF } : {}),
      ...(l.notes ? { notes: l.notes } : {}),
    };
  }

  private async assertParcelle(parcelleId: string | undefined, tenantId: string) {
    if (!parcelleId) return;
    const p = await this.prisma.parcelle.findFirst({
      where: { id: parcelleId },
      select: { id: true, tenantId: true },
    });
    if (!p) throw new ForbiddenException("Parcelle introuvable");
    if (p.tenantId === tenantId) return;
    // Parcelle d'un partenaire : OK si PartnerLink ACTIVE entre les deux.
    const link = await this.prisma.partnerLink.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { ownerTenantId: p.tenantId, partnerTenantId: tenantId },
          { ownerTenantId: tenantId, partnerTenantId: p.tenantId },
        ],
      },
      select: { id: true },
    });
    if (!link) {
      throw new ForbiddenException(
        "Cette parcelle appartient à un tenant non lié — invite-le comme partenaire d'abord.",
      );
    }
  }

  private async assertPartenaire(partenaireId: string | undefined, _tenantId: string) {
    if (!partenaireId) return;
    const p = await this.prisma.exploitation.findUnique({
      where: { id: partenaireId },
      select: { id: true },
    });
    if (!p) throw new BadRequestException("Partenaire introuvable");
  }

  /** Vérifie que le projet existe et appartient au tenant courant. */
  private async assertProjet(projetId: string | undefined, tenantId: string) {
    if (!projetId) return;
    const p = await this.prisma.projet.findFirst({
      where: { id: projetId, tenantId },
      select: { id: true },
    });
    if (!p) throw new BadRequestException("Projet introuvable dans ton exploitation.");
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
