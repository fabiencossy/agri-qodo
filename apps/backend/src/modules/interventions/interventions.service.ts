import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InterventionType,
  type Prisma,
  ProduitCategorie,
  TravailStatut,
  ValidationStatus,
} from "@prisma/client";
import area from "@turf/area";
import { randomUUID } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { OdooPushService } from "@/modules/travaux/odoo-push.service";
import type {
  CreateInterventionDto,
  InterventionGeoJsonGeometry,
} from "./dto/create-intervention.dto";
import type { UpdateInterventionDto } from "./dto/update-intervention.dto";

@Injectable()
export class InterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooPush: OdooPushService,
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

  /**
   * Interventions PENDING reçues d'un partenaire sur une de mes parcelles.
   * Le tenant courant est le propriétaire (ownerTenantId), un autre tenant
   * a saisi (authorTenantId !== owner). Le propriétaire doit décider de
   * VALIDER, REFUSER ou modifier l'intervention avant qu'elle entre dans
   * son carnet.
   */
  listPending() {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.intervention.findMany({
      where: {
        ownerTenantId: tenantId,
        validationStatus: ValidationStatus.PENDING,
      },
      orderBy: { dateOperation: "desc" },
      include: {
        ...this.includeRelations,
        authorTenant: { select: { id: true, nom: true, code: true } },
      },
    });
  }

  /** Valide une intervention PENDING reçue d'un partenaire. Owner only. */
  async validatePending(id: string) {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.intervention.findFirst({
      where: { id, ownerTenantId: tenantId },
      select: { id: true, validationStatus: true },
    });
    if (!existing) throw new NotFoundException("Intervention introuvable");
    if (existing.validationStatus !== ValidationStatus.PENDING) {
      throw new BadRequestException("Seules les interventions PENDING peuvent être validées");
    }
    await this.prisma.intervention.update({
      where: { id },
      data: { validationStatus: ValidationStatus.VALIDATED, validatedAt: new Date() },
    });
    return this.getById(id);
  }

  /**
   * Refuse une intervention PENDING. Annule en parallèle le Travail
   * prestataire associé (si DRAFT — sinon on laisse, le prestataire
   * gérera côté Odoo).
   */
  async rejectPending(id: string, reason: string | undefined) {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.intervention.findFirst({
      where: { id, ownerTenantId: tenantId },
      select: { id: true, validationStatus: true, linkedTravailId: true },
    });
    if (!existing) throw new NotFoundException("Intervention introuvable");
    if (existing.validationStatus !== ValidationStatus.PENDING) {
      throw new BadRequestException("Seules les interventions PENDING peuvent être refusées");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.intervention.update({
        where: { id },
        data: {
          validationStatus: ValidationStatus.REJECTED,
          rejectedReason: reason ?? null,
        },
      });
      // Annule le Travail prestataire associé s'il est en DRAFT.
      if (existing.linkedTravailId) {
        const travail = await tx.travail.findUnique({
          where: { id: existing.linkedTravailId },
          select: { statut: true },
        });
        if (travail?.statut === "DRAFT") {
          await tx.travail.update({
            where: { id: existing.linkedTravailId },
            data: { statut: "CANCELLED" },
          });
        }
      }
    });
    return this.getById(id);
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
    parcelle: { select: { id: true, nom: true, tenantId: true } },
    produitRef: { select: { id: true, libelle: true, categorie: true, especeCode: true } },
    materielRef: {
      select: { id: true, libelle: true, categorie: true, unite: true, prixUnitaireCHF: true },
    },
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

    // Parcelle accessible : la mienne OU celle d'un partenaire ACTIVE.
    const parcelle = await this.prisma.parcelle.findFirst({
      where: { id: dto.parcelleId },
      select: { id: true, tenantId: true, surfaceM2: true, odooPartnerId: true },
    });
    if (!parcelle) {
      throw new ForbiddenException("Parcelle introuvable");
    }
    if (parcelle.tenantId !== tenantId) {
      const link = await this.prisma.partnerLink.findFirst({
        where: {
          status: "ACTIVE",
          OR: [
            { ownerTenantId: parcelle.tenantId, partnerTenantId: tenantId },
            { ownerTenantId: tenantId, partnerTenantId: parcelle.tenantId },
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

    // Si une géom est fournie, elle est la source de vérité : on valide
    // qu'elle est incluse dans la parcelle (ST_Within Postgres) et on
    // recalcule la surface depuis le polygone — la valeur saisie par
    // l'utilisateur est ignorée. Sinon, on borne la surface partielle
    // saisie à la surface de la parcelle.
    let surfaceFromGeom: number | undefined;
    if (dto.geomGeoJson) {
      surfaceFromGeom = await this.validateAndMeasureSubzone(dto.geomGeoJson, dto.parcelleId);
    } else if (
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

    // Matériel optionnel — outil/machine utilisé. Catalogue global ou tenant.
    if (dto.materielId) {
      const materiel = await this.prisma.materiel.findFirst({
        where: {
          id: dto.materielId,
          actif: true,
          OR: [{ tenantId: null }, { tenantId }],
        },
        select: { id: true },
      });
      if (!materiel) throw new BadRequestException("Matériel introuvable ou inactif");
    }

    // Surface en hectares — si non fournie, on calcule depuis geom (priorité)
    // ou depuis la parcelle entière. Sert à la facturation matériel à l'ha.
    const surfaceHaResolu =
      dto.surfaceHa !== undefined
        ? dto.surfaceHa
        : surfaceFromGeom !== undefined
          ? surfaceFromGeom / 10000
          : Number(parcelle.surfaceM2) / 10000;

    // SEMIS = déclencheur de Culture. Carnet = source unique : pas de
    // saisie séparée. Le produit doit être une SEMENCE avec especeCode.
    const result = await this.prisma.$transaction(async (tx) => {
      let cultureId: string | null = null;
      if (dto.type === InterventionType.SEMIS && produit) {
        if (produit.categorie !== ProduitCategorie.SEMENCE) {
          throw new BadRequestException(
            "Pour un SEMIS, le produit doit être une semence du catalogue",
          );
        }
        // especeCode est facultatif (les produits importés depuis Odoo
        // ou créés à la volée n'ont souvent que le libelle). Si absent,
        // on utilise le libelle comme nom d'espèce — l'agriculteur
        // pourra l'enrichir plus tard.
        const especeFallback = (produit.especeCode ?? produit.libelle).trim().slice(0, 80);
        const created = await tx.culture.create({
          data: {
            tenantId: ownerTenantId,
            parcelleId: dto.parcelleId,
            espece: especeFallback,
            variete: produit.especeCode ? produit.libelle : null,
            dateSemis: dateOperation,
            campagne: dateOperation.getUTCFullYear(),
          },
          select: { id: true },
        });
        cultureId = created.id;
      }

      const surfaceFinale =
        surfaceFromGeom !== undefined ? surfaceFromGeom : (dto.surfaceTravailleeM2 ?? null);

      const created = await tx.intervention.create({
        data: {
          clientUuid: dto.clientUuid ?? randomUUID(),
          parcelleId: dto.parcelleId,
          ownerTenantId,
          authorTenantId,
          type: dto.type,
          dateOperation,
          produitId: produit?.id ?? null,
          produit: dto.produit ?? produit?.libelle ?? null,
          materielId: dto.materielId ?? null,
          surfaceHa: surfaceHaResolu,
          rendementParHa: dto.rendementParHa ?? null,
          quantite: dto.quantite ?? null,
          unite: dto.unite ?? null,
          surfaceTravailleeM2: surfaceFinale,
          notes: dto.notes ?? null,
          techniqueEpandage: dto.techniqueEpandage ?? null,
          cultureId,
          validationStatus,
          ...resolveHeures(dto),
          datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : null,
          assignedToUserId: dto.assignedToUserId ?? null,
        },
        include: this.includeRelations,
      });

      // Durée résolue pour propagation au Travail (LigneTravailHeure) :
      // si l'agriculteur a saisi heureDebut/heureFin OU dureeMinutes,
      // on remonte la durée pour que le push Odoo crée un timesheet
      // sur la project.task.
      const heuresResolved = resolveHeures(dto);
      const dureeMin = heuresResolved.dureeMinutes;

      if (dto.geomGeoJson) {
        await tx.$executeRawUnsafe(
          `UPDATE interventions
             SET geom = ST_GeomFromGeoJSON($1)::geometry(Polygon, 4326)
           WHERE id = $2`,
          JSON.stringify(dto.geomGeoJson),
          created.id,
        );
      }

      // Cas B (intervention sur parcelle d'un partenaire) : on crée
      // automatiquement un Travail facturable chez le prestataire (=
      // tenant courant), avec partenaireId = propriétaire de la parcelle.
      // Cas C (parcelle créée pour un client Odoo non-partenaire) :
      // même chose mais avec odooPartnerId à la place de partenaireId.
      let casBTravailId: string | null = null;
      const casC = parcelle.odooPartnerId !== null && parcelle.odooPartnerId !== undefined;
      if (validationStatus === ValidationStatus.PENDING || casC) {
        casBTravailId = await this.createCasBTravail(tx, {
          interventionId: created.id,
          authorTenantId,
          ...(casC
            ? { odooPartnerId: parcelle.odooPartnerId as number }
            : { partenaireId: ownerTenantId }),
          parcelleId: dto.parcelleId,
          type: dto.type,
          dateOperation,
          materielId: dto.materielId,
          surfaceHa: surfaceHaResolu,
          notes: dto.notes,
          dureeMinutes: dureeMin,
        });

        return {
          intervention: await tx.intervention.findUniqueOrThrow({
            where: { id: created.id },
            include: this.includeRelations,
          }),
          casBTravailId,
        };
      }

      return { intervention: created, casBTravailId };
    });

    // Hors transaction : push automatique Odoo. Best-effort dans les deux
    // cas — si Odoo est down ou mal configuré, l'intervention reste OK et
    // l'utilisateur peut re-pousser manuellement plus tard.
    if (result.casBTravailId) {
      // Cas B : devis Odoo (sale.order draft) sur le Travail facturable.
      await this.odooPush.tryPushTravailQuotation(result.casBTravailId);
    } else {
      // Cas A : project.task Odoo (pas de facturation) pour tracer
      // l'intervention dans le projet "Carnet des champs" du tenant.
      await this.odooPush.tryPushInterventionTask(result.intervention.id);
    }
    // Recharge l'intervention pour exposer odooTaskId / linkedTravailId à jour.
    return this.prisma.intervention.findUniqueOrThrow({
      where: { id: result.intervention.id },
      include: this.includeRelations,
    });
  }

  /**
   * Crée le Travail prestataire en cas B (intervention sur parcelle de
   * partenaire). À appeler dans la transaction de `create()` après que
   * l'intervention a été insérée. Met à jour `intervention.linkedTravailId`.
   */
  private async createCasBTravail(
    tx: Prisma.TransactionClient,
    args: {
      interventionId: string;
      authorTenantId: string;
      /** Cas B : tenant Agri Qodo propriétaire de la parcelle. */
      partenaireId?: string;
      /** Cas C : client Odoo non-partenaire (res.partner). */
      odooPartnerId?: number;
      parcelleId: string;
      type: InterventionType;
      dateOperation: Date;
      materielId: string | undefined;
      surfaceHa: number;
      notes: string | undefined;
      /** Durée de l'intervention en minutes — propagée en LigneTravailHeure. */
      dureeMinutes?: number | null;
    },
  ): Promise<string> {
    const parcelle = await tx.parcelle.findUnique({
      where: { id: args.parcelleId },
      select: { nom: true },
    });
    const titreType = args.type.replace(/_/g, " ").toLowerCase();
    const titre = `${titreType.charAt(0).toUpperCase()}${titreType.slice(1)} — ${parcelle?.nom ?? "parcelle"}`;

    const lignesProduit: Prisma.LigneTravailProduitCreateWithoutTravailInput[] = [];

    if (args.materielId) {
      const m = await tx.materiel.findUnique({
        where: { id: args.materielId },
        select: { libelle: true, unite: true, prixUnitaireCHF: true },
      });
      if (m) {
        lignesProduit.push({
          libelle: m.libelle,
          quantite: args.surfaceHa,
          unite: m.unite.toLowerCase(),
          prixUnitaireCHF: m.prixUnitaireCHF,
        });
      }
    }

    // NOTE Fabien 2026-05-06 : on ne facture PAS la semence/le produit
    // au client. C'est juste de l'info agronomique pour le carnet des
    // champs (création de la Culture côté SEMIS). Seul le matériel
    // (prestation à l'hectare) entre dans le devis client.

    // Propage la durée de l'intervention en LigneTravailHeure pour
    // que le push Odoo crée un account.analytic.line (timesheet) sur
    // la project.task → "Temps passé" non nul côté Odoo.
    // userId = author de l'intervention. Tarif horaire : null pour
    // que la ligne ne fasse pas grimper le total facturé (heures
    // non-facturables, demande Fabien 2026-05-06).
    const lignesHeure: Prisma.LigneTravailHeureCreateWithoutTravailInput[] = [];
    if (args.dureeMinutes && args.dureeMinutes > 0) {
      const ctx = this.tenantContext.tryGet();
      if (ctx?.userId) {
        lignesHeure.push({
          dureeMinutes: args.dureeMinutes,
          user: { connect: { id: ctx.userId } },
          notes: titre,
        });
      }
    }

    const travail = await tx.travail.create({
      data: {
        tenantId: args.authorTenantId,
        ...(args.partenaireId ? { partenaireId: args.partenaireId } : {}),
        ...(args.odooPartnerId !== undefined ? { odooPartnerId: args.odooPartnerId } : {}),
        parcelleId: args.parcelleId,
        titre,
        date: args.dateOperation,
        statut: TravailStatut.DRAFT,
        notes: args.notes ?? null,
        ...(lignesProduit.length > 0 ? { lignesProduit: { create: lignesProduit } } : {}),
        ...(lignesHeure.length > 0 ? { lignesHeure: { create: lignesHeure } } : {}),
      },
      select: { id: true },
    });

    await tx.intervention.update({
      where: { id: args.interventionId },
      data: { linkedTravailId: travail.id },
    });

    return travail.id;
  }

  /**
   * Vérifie qu'un polygone est inclus dans la parcelle cible (ST_Within
   * en CRS 4326) et retourne sa surface en m² (calculée via @turf/area
   * sur l'ellipsoïde WGS84, cohérent avec le calcul des parcelles à
   * l'import). Throw 400 si le polygone déborde ou si le GeoJSON est
   * mal formé.
   */
  private async validateAndMeasureSubzone(
    geom: InterventionGeoJsonGeometry,
    parcelleId: string,
  ): Promise<number> {
    // class-validator ne vérifie que `IsObject` ; on contrôle ici le
    // type GeoJSON exact pour rejeter MultiPolygon/Point/etc à runtime.
    const runtimeType = (geom as { type?: unknown }).type;
    if (runtimeType !== "Polygon") {
      throw new BadRequestException("La sous-zone d'intervention doit être un Polygon GeoJSON");
    }

    const rows = await this.prisma.$queryRawUnsafe<{ within: boolean | null }[]>(
      `SELECT ST_Within(
                ST_GeomFromGeoJSON($1)::geometry(Polygon, 4326),
                (SELECT geom FROM parcelles WHERE id = $2)
              ) AS within`,
      JSON.stringify(geom),
      parcelleId,
    );
    const within = rows[0]?.within;
    if (within === null) {
      throw new BadRequestException(
        "La parcelle n'a pas encore de géométrie — impossible de saisir une sous-zone, dessine d'abord la parcelle complète.",
      );
    }
    if (within !== true) {
      throw new BadRequestException(
        "Le polygone d'intervention déborde de la parcelle — recadre la zone à l'intérieur des limites.",
      );
    }

    return area({ type: "Feature", geometry: geom, properties: {} });
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
        select: { id: true, cultureId: true, dateOperation: true, parcelleId: true },
      });
      if (!existing) {
        throw new NotFoundException("Intervention introuvable");
      }

      const newDate = dto.dateOperation ? new Date(dto.dateOperation) : null;

      // Si geom fournie, on valide + recalcule la surface (la valeur
      // saisie est ignorée comme à la création). Si geom passée à `null`
      // explicitement, on retire la sous-zone (l'intervention couvre
      // toute la parcelle à nouveau).
      let surfaceFromGeom: number | undefined;
      if (dto.geomGeoJson) {
        surfaceFromGeom = await this.validateAndMeasureSubzone(
          dto.geomGeoJson,
          existing.parcelleId,
        );
      }

      // Si materielId fourni, on valide qu'il existe (global ou tenant).
      if (dto.materielId) {
        const materiel = await tx.materiel.findFirst({
          where: {
            id: dto.materielId,
            actif: true,
            OR: [{ tenantId: null }, { tenantId }],
          },
          select: { id: true },
        });
        if (!materiel) throw new BadRequestException("Matériel introuvable ou inactif");
      }

      await tx.intervention.update({
        where: { id },
        data: {
          ...(newDate !== null ? { dateOperation: newDate } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.parcelleId !== undefined ? { parcelleId: dto.parcelleId } : {}),
          ...(dto.produitId !== undefined ? { produitId: dto.produitId || null } : {}),
          ...(dto.produit !== undefined ? { produit: dto.produit } : {}),
          ...(dto.materielId !== undefined ? { materielId: dto.materielId || null } : {}),
          ...(dto.surfaceHa !== undefined ? { surfaceHa: dto.surfaceHa } : {}),
          ...(dto.rendementParHa !== undefined ? { rendementParHa: dto.rendementParHa } : {}),
          ...(dto.quantite !== undefined ? { quantite: dto.quantite } : {}),
          ...(dto.unite !== undefined ? { unite: dto.unite } : {}),
          ...(surfaceFromGeom !== undefined
            ? { surfaceTravailleeM2: surfaceFromGeom }
            : dto.surfaceTravailleeM2 !== undefined
              ? { surfaceTravailleeM2: dto.surfaceTravailleeM2 }
              : {}),
          ...(dto.techniqueEpandage !== undefined
            ? { techniqueEpandage: dto.techniqueEpandage }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.heureDebut !== undefined
            ? { heureDebut: dto.heureDebut ? new Date(dto.heureDebut) : null }
            : {}),
          ...(dto.heureFin !== undefined
            ? { heureFin: dto.heureFin ? new Date(dto.heureFin) : null }
            : {}),
          ...(dto.dureeMinutes !== undefined ? { dureeMinutes: dto.dureeMinutes } : {}),
          ...(dto.datePrevue !== undefined
            ? { datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : null }
            : {}),
          ...(dto.assignedToUserId !== undefined
            ? { assignedToUserId: dto.assignedToUserId || null }
            : {}),
        },
      });

      if (dto.geomGeoJson !== undefined) {
        if (dto.geomGeoJson === null) {
          await tx.$executeRawUnsafe(`UPDATE interventions SET geom = NULL WHERE id = $1`, id);
        } else {
          await tx.$executeRawUnsafe(
            `UPDATE interventions
               SET geom = ST_GeomFromGeoJSON($1)::geometry(Polygon, 4326)
             WHERE id = $2`,
            JSON.stringify(dto.geomGeoJson),
            id,
          );
        }
      }

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
   * Récupère les interventions du tenant courant qui ont une sous-zone
   * géométrique, avec leur Polygon en GeoJSON. Sert de base à la page
   * Plan d'assolement (PR-2) — ici on l'expose dès maintenant pour que
   * la PR fondation soit complètement testable bout-en-bout.
   */
  async listWithGeom(filters?: { campagne?: number; parcelleId?: string }) {
    const { tenantId } = this.tenantContext.get();
    const conditions: string[] = [
      `(i.owner_tenant_id::text = $1 OR i.author_tenant_id::text = $1)`,
    ];
    const params: unknown[] = [tenantId];
    if (filters?.campagne !== undefined) {
      params.push(filters.campagne);
      conditions.push(`EXTRACT(YEAR FROM i.date_operation) = $${params.length}`);
    }
    if (filters?.parcelleId) {
      params.push(filters.parcelleId);
      conditions.push(`i.parcelle_id::text = $${params.length}`);
    }
    const sql = `SELECT
        i.id,
        i.parcelle_id AS "parcelleId",
        p.nom AS "parcelleNom",
        i.type::text AS type,
        i.date_operation AS "dateOperation",
        i.surface_travaillee_m2::text AS "surfaceTravailleeM2",
        i.produit,
        c.espece AS "cultureEspece",
        c.variete AS "cultureVariete",
        c.campagne AS "cultureCampagne",
        ST_AsGeoJSON(i.geom) AS geom
      FROM interventions i
      JOIN parcelles p ON p.id = i.parcelle_id
      LEFT JOIN cultures c ON c.id = i.culture_id
      WHERE ${conditions.join(" AND ")} AND i.geom IS NOT NULL
      ORDER BY i.date_operation DESC`;
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        parcelleId: string;
        parcelleNom: string;
        type: string;
        dateOperation: Date;
        surfaceTravailleeM2: string | null;
        produit: string | null;
        cultureEspece: string | null;
        cultureVariete: string | null;
        cultureCampagne: number | null;
        geom: string | null;
      }[]
    >(sql, ...params);
    return rows.map((r) => ({
      id: r.id,
      parcelleId: r.parcelleId,
      parcelleNom: r.parcelleNom,
      type: r.type,
      dateOperation: r.dateOperation,
      surfaceTravailleeM2: r.surfaceTravailleeM2,
      produit: r.produit,
      culture: r.cultureEspece
        ? {
            espece: r.cultureEspece,
            variete: r.cultureVariete,
            campagne: r.cultureCampagne ?? 0,
          }
        : null,
      geom: r.geom ? (JSON.parse(r.geom) as InterventionGeoJsonGeometry) : null,
    }));
  }

  /**
   * Sprint 2 fusion-interventions — Planning. Marque une intervention
   * comme terminée. OWNER → validationStatus=VALIDATED direct. EMPLOYE
   * → validationStatus=PENDING (en attente OWNER).
   */
  async markCompleted(id: string) {
    const { tenantId, role } = this.tenantContext.get();
    const existing = await this.prisma.intervention.findFirst({
      where: { id, ownerTenantId: tenantId },
      select: { id: true, validationStatus: true },
    });
    if (!existing) throw new NotFoundException("Intervention introuvable");
    if (existing.validationStatus === ValidationStatus.VALIDATED) {
      throw new ConflictException("Intervention déjà validée.");
    }
    const nextStatus = role === "OWNER" ? ValidationStatus.VALIDATED : ValidationStatus.PENDING;
    const updated = await this.prisma.intervention.update({
      where: { id },
      data: {
        validationStatus: nextStatus,
        ...(nextStatus === ValidationStatus.VALIDATED ? { validatedAt: new Date() } : {}),
      },
      include: this.includeRelations,
    });
    return updated;
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

/**
 * Calcule le tuple {heureDebut, heureFin, dureeMinutes} cohérent à partir
 * du DTO. Règle (PRD fusion v0.2 §3.3) :
 * - Si heureDebut+heureFin fournis : on recalcule dureeMinutes depuis
 *   l'écart (la valeur du DTO est ignorée pour éviter la divergence).
 * - Si seul dureeMinutes fourni : on garde, heureDebut/heureFin restent null.
 * - Sinon (rien) : tout null.
 */
function resolveHeures(dto: { heureDebut?: string; heureFin?: string; dureeMinutes?: number }): {
  heureDebut: Date | null;
  heureFin: Date | null;
  dureeMinutes: number | null;
} {
  if (dto.heureDebut && dto.heureFin) {
    const debut = new Date(dto.heureDebut);
    const fin = new Date(dto.heureFin);
    const minutes = Math.max(0, Math.round((fin.getTime() - debut.getTime()) / 60_000));
    return { heureDebut: debut, heureFin: fin, dureeMinutes: minutes };
  }
  if (dto.dureeMinutes !== undefined && dto.dureeMinutes !== null) {
    return { heureDebut: null, heureFin: null, dureeMinutes: dto.dureeMinutes };
  }
  return { heureDebut: null, heureFin: null, dureeMinutes: null };
}
