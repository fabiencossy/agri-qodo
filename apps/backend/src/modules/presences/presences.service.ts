import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { ClockOutPresenceDto } from "./dto/clock-out-presence.dto";
import type { CreatePresenceDto } from "./dto/create-presence.dto";

/**
 * Service Présences — pointage employé style qodo-clock.
 *
 * Règles métier :
 *  - Une seule présence ouverte (dateFin null) par user à la fois.
 *    Le clock-in re-clock fermerait l'ancienne avant la nouvelle ?
 *    Pour MVP : on rejette en 409 et l'utilisateur doit clock-out.
 *  - À la sortie, si la présence a un travailId, on génère une
 *    LigneTravailHeure dédupliquée (linkedLigneHeureId stocké).
 */
@Injectable()
export class PresencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private readonly include = {
    user: { select: { id: true, prenom: true, nom: true, email: true } },
    travail: { select: { id: true, titre: true, date: true } },
  } satisfies Prisma.PresenceInclude;

  /** Présence ouverte du user courant — null si pas pointé. */
  async current() {
    const ctx = this.tenantContext.get();
    return this.prisma.presence.findFirst({
      where: { tenantId: ctx.tenantId, userId: ctx.userId, dateFin: null },
      include: this.include,
      orderBy: { dateDebut: "desc" },
    });
  }

  /**
   * Mes présences sur une fenêtre donnée (default = semaine courante).
   * Ordre chrono décroissant pour affichage timeline.
   */
  async mes(filters?: { dateDebut?: string; dateFin?: string }) {
    const ctx = this.tenantContext.get();
    const where: Prisma.PresenceWhereInput = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    };
    if (filters?.dateDebut || filters?.dateFin) {
      const range: { gte?: Date; lte?: Date } = {};
      if (filters.dateDebut) range.gte = new Date(filters.dateDebut);
      if (filters.dateFin) range.lte = new Date(filters.dateFin);
      where.dateDebut = range;
    }
    return this.prisma.presence.findMany({
      where,
      include: this.include,
      orderBy: { dateDebut: "desc" },
      take: 200,
    });
  }

  /** Vue admin : toutes les présences du tenant (qui a fait quoi quand). */
  async list(filters?: { userId?: string; dateDebut?: string; dateFin?: string }) {
    const ctx = this.tenantContext.get();
    const where: Prisma.PresenceWhereInput = { tenantId: ctx.tenantId };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.dateDebut || filters?.dateFin) {
      const range: { gte?: Date; lte?: Date } = {};
      if (filters.dateDebut) range.gte = new Date(filters.dateDebut);
      if (filters.dateFin) range.lte = new Date(filters.dateFin);
      where.dateDebut = range;
    }
    return this.prisma.presence.findMany({
      where,
      include: this.include,
      orderBy: { dateDebut: "desc" },
      take: 500,
    });
  }

  /** Démarre une nouvelle présence (clock-in). Refuse si une est ouverte. */
  async clockIn(dto: CreatePresenceDto) {
    const ctx = this.tenantContext.get();
    const open = await this.prisma.presence.findFirst({
      where: { tenantId: ctx.tenantId, userId: ctx.userId, dateFin: null },
      select: { id: true, type: true, dateDebut: true },
    });
    if (open) {
      throw new ConflictException(
        `Une présence est déjà ouverte (${open.type} depuis ${open.dateDebut.toISOString()}). Pointe la sortie d'abord.`,
      );
    }
    if (dto.travailId) {
      await this.assertTravail(dto.travailId);
    }
    const dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : new Date();
    return this.prisma.presence.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        type: dto.type,
        dateDebut,
        ...(dto.travailId ? { travailId: dto.travailId } : {}),
        ...(dto.latitudeDebut !== undefined ? { latitudeDebut: dto.latitudeDebut } : {}),
        ...(dto.longitudeDebut !== undefined ? { longitudeDebut: dto.longitudeDebut } : {}),
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
      include: this.include,
    });
  }

  /**
   * Ferme la présence ouverte du user courant (clock-out). Calcule
   * dureeMinutes. Si un travailId est lié, génère automatiquement une
   * LigneTravailHeure et stocke linkedLigneHeureId pour idempotence.
   */
  async clockOut(presenceId: string | "current", dto: ClockOutPresenceDto) {
    const ctx = this.tenantContext.get();
    const where: Prisma.PresenceWhereInput =
      presenceId === "current"
        ? { tenantId: ctx.tenantId, userId: ctx.userId, dateFin: null }
        : { id: presenceId, tenantId: ctx.tenantId, userId: ctx.userId };
    const presence = await this.prisma.presence.findFirst({
      where,
      orderBy: { dateDebut: "desc" },
    });
    if (!presence) throw new NotFoundException("Aucune présence ouverte à fermer.");
    if (presence.dateFin) {
      throw new ConflictException("Cette présence est déjà fermée.");
    }

    const dateFin = dto.dateFin ? new Date(dto.dateFin) : new Date();
    if (dateFin.getTime() <= presence.dateDebut.getTime()) {
      throw new BadRequestException("La sortie doit être postérieure à l'entrée.");
    }
    const dureeMinutes = Math.round((dateFin.getTime() - presence.dateDebut.getTime()) / 60000);
    const travailId = dto.travailId ?? presence.travailId ?? undefined;
    if (travailId) await this.assertTravail(travailId);

    return this.prisma.$transaction(async (tx) => {
      let linkedLigneHeureId: string | null = null;
      // Génère la LigneTravailHeure liée si on a un travail et qu'on
      // n'a pas demandé de skip. Type CHANTIER/DEPLACEMENT/REPAS = facturable
      // (selon convention) ; PAUSE/BUREAU = on ne report pas par défaut.
      const facturable =
        !!travailId &&
        !dto.skipTimesheet &&
        ["CHANTIER", "DEPLACEMENT", "REPAS"].includes(presence.type);
      if (facturable && travailId) {
        const ligne = await tx.ligneTravailHeure.create({
          data: {
            travailId,
            userId: ctx.userId,
            heureDebut: presence.dateDebut,
            heureFin: dateFin,
            dureeMinutes,
            notes: dto.notes ?? presence.notes,
          },
          select: { id: true },
        });
        linkedLigneHeureId = ligne.id;
      }

      return tx.presence.update({
        where: { id: presence.id },
        data: {
          dateFin,
          dureeMinutes,
          ...(travailId ? { travailId } : {}),
          ...(linkedLigneHeureId ? { linkedLigneHeureId } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        include: this.include,
      });
    });
  }

  /**
   * Modification manuelle d'une présence (admin ou self). Recalcule
   * `dureeMinutes` automatiquement si `dateDebut` et/ou `dateFin`
   * changent. Permet la correction de saisies passées (oubli de
   * pointage, erreur d'heure).
   */
  async update(
    id: string,
    dto: {
      type?: import("@prisma/client").PresenceType;
      dateDebut?: string;
      dateFin?: string;
      travailId?: string;
      notes?: string;
    },
  ) {
    const ctx = this.tenantContext.get();
    const existing = await this.prisma.presence.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) throw new NotFoundException("Présence introuvable");
    if (dto.travailId) await this.assertTravail(dto.travailId);

    // Calcul de la nouvelle durée si l'une des bornes change. On part
    // toujours des valeurs résultantes (existing fallback) pour gérer
    // le cas où on ne touche qu'une seule borne.
    const nextDebut = dto.dateDebut !== undefined ? new Date(dto.dateDebut) : existing.dateDebut;
    const nextFin =
      dto.dateFin !== undefined ? (dto.dateFin ? new Date(dto.dateFin) : null) : existing.dateFin;
    let dureeMinutes: number | null = existing.dureeMinutes;
    if (dto.dateDebut !== undefined || dto.dateFin !== undefined) {
      if (nextFin && nextDebut) {
        const diff = nextFin.getTime() - nextDebut.getTime();
        if (diff < 0) {
          throw new BadRequestException("La date de fin doit être après la date de début.");
        }
        dureeMinutes = Math.round(diff / 60000);
      } else {
        dureeMinutes = null;
      }
    }

    return this.prisma.presence.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.dateDebut !== undefined ? { dateDebut: nextDebut } : {}),
        ...(dto.dateFin !== undefined ? { dateFin: nextFin } : {}),
        ...(dto.dateDebut !== undefined || dto.dateFin !== undefined ? { dureeMinutes } : {}),
        ...(dto.travailId !== undefined ? { travailId: dto.travailId || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const ctx = this.tenantContext.get();
    const existing = await this.prisma.presence.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, linkedLigneHeureId: true },
    });
    if (!existing) throw new NotFoundException("Présence introuvable");
    await this.prisma.$transaction(async (tx) => {
      if (existing.linkedLigneHeureId) {
        await tx.ligneTravailHeure
          .delete({ where: { id: existing.linkedLigneHeureId } })
          .catch(() => undefined);
      }
      await tx.presence.delete({ where: { id } });
    });
  }

  private async assertTravail(travailId: string) {
    const ctx = this.tenantContext.get();
    const travail = await this.prisma.travail.findFirst({
      where: { id: travailId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!travail) throw new BadRequestException("Travail introuvable ou hors exploitation.");
  }
}
