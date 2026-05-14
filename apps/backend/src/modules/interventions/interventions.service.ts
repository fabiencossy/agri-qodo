import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(InterventionsService.name);

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
    // Plan d'assolement : sur-semis autorisé, mais front affiche une
    // confirmation avant submit. Pas de blocage serveur (cf 2026-05-08).
    let surfaceFromGeom: number | undefined;
    if (dto.geomGeoJson) {
      const measure = await this.validateAndMeasureSubzone(dto.geomGeoJson, dto.parcelleId);
      // Ratio proportionnel : si géom parcelle = 5.98 ha mais déclaré
      // 2.89 ha, ratio = 0.483, et une sous-zone tracée à 50 % de la
      // géom (≈3 ha brut) sera enregistrée à 1.45 ha. Cohérent UI/back.
      const surfaceParcelleM2 = Number(parcelle.surfaceM2);
      const ratio =
        surfaceParcelleM2 > 0 &&
        measure.geomParcelleAreaM2 !== null &&
        measure.geomParcelleAreaM2 > 0
          ? surfaceParcelleM2 / measure.geomParcelleAreaM2
          : 1;
      surfaceFromGeom = measure.rawAreaM2 * ratio;
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

    // Anti-chevauchement (Fabien 2026-05-14 image 55 #4) :
    // un même employé ne peut pas avoir deux plages horaires qui se
    // chevauchent — qu'elles viennent d'autres interventions ou de
    // LigneTravailHeure (saisies dans un Travail tiers).
    await this.assertNoUserHoursOverlap({
      assignedToUserId: dto.assignedToUserId,
      heureDebut: dto.heureDebut,
      heureFin: dto.heureFin,
    });

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
          // datePrevue : par défaut = dateOperation pour que toutes les
          // interventions apparaissent dans /planning. Décision Fabien
          // 2026-05-06 : "le planning n'est tjs pas juste" — sans
          // datePrevue, le planning restait vide.
          datePrevue: dto.datePrevue ? new Date(dto.datePrevue) : dateOperation,
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
    // l'utilisateur peut re-pousser manuellement plus tard. On capture le
    // résultat pour le remonter à l'UI : bandeau d'erreur visible si push KO.
    let lastPushResult: {
      ok: boolean;
      error?: string;
      odooTaskId?: number | null;
      odooSaleOrderId?: number | null;
    } | null = null;
    if (result.casBTravailId) {
      try {
        const pushed = await this.odooPush.pushTravail(result.casBTravailId);
        lastPushResult = {
          ok: true,
          odooSaleOrderId: pushed.odooSaleOrderId,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Push Odoo (cas B travail ${result.casBTravailId}) échoué : ${msg}`);
        lastPushResult = { ok: false, error: msg };
      }
    } else {
      try {
        const pushed = await this.odooPush.tryPushInterventionTask(result.intervention.id);
        lastPushResult = pushed
          ? { ok: true, odooTaskId: pushed.taskId }
          : { ok: false, error: "Push Odoo n'a rien retourné (vérifier les logs)" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Push Odoo (cas A intervention ${result.intervention.id}) échoué : ${msg}`,
        );
        lastPushResult = { ok: false, error: msg };
      }
    }
    // Recharge l'intervention pour exposer odooTaskId / linkedTravailId à jour
    // et propage le résultat du push pour l'UI.
    const reloaded = await this.prisma.intervention.findUniqueOrThrow({
      where: { id: result.intervention.id },
      include: this.includeRelations,
    });
    return { ...reloaded, lastPushResult } as typeof reloaded & {
      lastPushResult: typeof lastPushResult;
    };
  }

  /**
   * Vérifie qu'aucune plage horaire existante ne chevauche celle qu'on
   * tente de saisir, pour un même employé. Considère :
   * - les autres Interventions (heureDebut/heureFin/assignedToUserId)
   * - les LigneTravailHeure (heureDebut/heureFin/userId)
   *
   * No-op si l'un des trois champs manque (saisie sans horaires précis).
   * Lève ConflictException avec un message explicite si trouvé.
   */
  private async assertNoUserHoursOverlap(args: {
    assignedToUserId?: string | null | undefined;
    heureDebut?: string | null | undefined;
    heureFin?: string | null | undefined;
    excludeInterventionId?: string;
  }): Promise<void> {
    if (!args.assignedToUserId || !args.heureDebut || !args.heureFin) return;
    const debut = new Date(args.heureDebut);
    const fin = new Date(args.heureFin);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) return;
    if (fin <= debut) return;

    // Chevauchement : autre.fin > newDebut ET autre.debut < newFin
    const conflictIntervention = await this.prisma.intervention.findFirst({
      where: {
        assignedToUserId: args.assignedToUserId,
        heureDebut: { lt: fin, not: null },
        heureFin: { gt: debut, not: null },
        ...(args.excludeInterventionId ? { id: { not: args.excludeInterventionId } } : {}),
      },
      select: {
        id: true,
        type: true,
        heureDebut: true,
        heureFin: true,
        parcelle: { select: { nom: true } },
      },
    });
    if (conflictIntervention) {
      const hd = conflictIntervention.heureDebut?.toISOString().slice(11, 16) ?? "—";
      const hf = conflictIntervention.heureFin?.toISOString().slice(11, 16) ?? "—";
      throw new ConflictException(
        `Chevauchement d'heures pour cet employé : une intervention "${conflictIntervention.type}" sur ${conflictIntervention.parcelle.nom} occupe déjà ${hd}–${hf}.`,
      );
    }

    const conflictLigne = await this.prisma.ligneTravailHeure.findFirst({
      where: {
        userId: args.assignedToUserId,
        heureDebut: { lt: fin, not: null },
        heureFin: { gt: debut, not: null },
      },
      select: {
        id: true,
        heureDebut: true,
        heureFin: true,
        travail: { select: { titre: true } },
      },
    });
    if (conflictLigne) {
      const hd = conflictLigne.heureDebut?.toISOString().slice(11, 16) ?? "—";
      const hf = conflictLigne.heureFin?.toISOString().slice(11, 16) ?? "—";
      throw new ConflictException(
        `Chevauchement d'heures pour cet employé : le travail "${conflictLigne.travail.titre}" occupe déjà ${hd}–${hf}.`,
      );
    }
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
  ): Promise<{ rawAreaM2: number; geomParcelleAreaM2: number | null }> {
    // class-validator ne vérifie que `IsObject` ; on contrôle ici le
    // type GeoJSON exact pour rejeter MultiPolygon/Point/etc à runtime.
    const runtimeType = (geom as { type?: unknown }).type;
    if (runtimeType !== "Polygon") {
      throw new BadRequestException("La sous-zone d'intervention doit être un Polygon GeoJSON");
    }

    // Récupère ST_Within + l'aire géom réelle de la parcelle en m²
    // (geography = ellipsoid, donne des m² fiables peu importe le SRID).
    // Sert à calculer le ratio de correction quand la géom diverge de
    // surfaceM2 déclaré (cf 2026-05-08).
    // ST_Area::geography échoue sur les installs PostGIS minimalistes
    // (spatial_ref_sys non peuplée) — on récupère plutôt la geom en
    // GeoJSON et on calcule l'aire côté Node avec turf.area, qui fait
    // le calcul ellipsoidal sans dépendre de spatial_ref_sys.
    // Le clip côté front (turf intersect) produit des polygones qui
    // suivent les bords de la parcelle, avec des micro-imprécisions
    // floating point qui font sortir 1-2 m² de la parcelle. ST_Within et
    // ST_CoveredBy rejettent strictement ces cas pourtant légitimes. On
    // mesure le débordement réel via ST_Difference et on tolère < 5 m².
    // Au-delà, c'est un vrai débordement → erreur.
    const TOLERANCE_M2 = 5;
    const rows = await this.prisma.$queryRawUnsafe<
      { has_geom: boolean | null; overflow_m2: number | null; geom_geojson: string | null }[]
    >(
      `WITH p AS (SELECT geom FROM parcelles WHERE id = $2),
            intv AS (
              SELECT ST_GeomFromGeoJSON($1)::geometry(Polygon, 4326) AS geom
            )
       SELECT
         (p.geom IS NOT NULL) AS has_geom,
         ST_Area(ST_Difference(intv.geom, p.geom)) AS overflow_m2,
         ST_AsGeoJSON(p.geom) AS geom_geojson
       FROM p, intv`,
      JSON.stringify(geom),
      parcelleId,
    );
    const hasGeom = rows[0]?.has_geom;
    if (!hasGeom) {
      throw new BadRequestException(
        "La parcelle n'a pas encore de géométrie — impossible de saisir une sous-zone, dessine d'abord la parcelle complète.",
      );
    }
    const overflow = Number(rows[0]?.overflow_m2 ?? 0);
    // ST_Area en SRID 4326 retourne des degrés² — on prend une grosse
    // tolérance (≈ 1e-9 deg² ≈ 12 m² à nos latitudes). Si overflow > 0,
    // c'est qu'il y a un vrai débordement, pas juste de l'imprécision.
    if (overflow > 1e-9) {
      throw new BadRequestException(
        "Le polygone d'intervention déborde de la parcelle — recadre la zone à l'intérieur des limites.",
      );
    }
    void TOLERANCE_M2;

    let geomParcelleAreaM2: number | null = null;
    const geomGeojson = rows[0]?.geom_geojson;
    if (geomGeojson) {
      try {
        const parsed = JSON.parse(geomGeojson) as InterventionGeoJsonGeometry;
        geomParcelleAreaM2 = area({ type: "Feature", geometry: parsed, properties: {} });
      } catch {
        // GeoJSON malformé — on n'applique pas de ratio dans ce cas.
      }
    }
    return {
      rawAreaM2: area({ type: "Feature", geometry: geom, properties: {} }),
      geomParcelleAreaM2,
    };
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
        select: {
          id: true,
          cultureId: true,
          dateOperation: true,
          parcelleId: true,
          heureDebut: true,
          heureFin: true,
          assignedToUserId: true,
          parcelle: { select: { surfaceM2: true } },
        },
      });
      if (!existing) {
        throw new NotFoundException("Intervention introuvable");
      }

      // Anti-chevauchement à l'update (Fabien 2026-05-14 image 55 #4) :
      // si les heures ou l'employé bougent, on revalide en excluant
      // l'intervention courante.
      const willTouchHours =
        dto.heureDebut !== undefined ||
        dto.heureFin !== undefined ||
        dto.assignedToUserId !== undefined;
      if (willTouchHours) {
        await this.assertNoUserHoursOverlap({
          assignedToUserId:
            dto.assignedToUserId !== undefined ? dto.assignedToUserId : existing.assignedToUserId,
          heureDebut:
            dto.heureDebut !== undefined ? dto.heureDebut : existing.heureDebut?.toISOString(),
          heureFin: dto.heureFin !== undefined ? dto.heureFin : existing.heureFin?.toISOString(),
          excludeInterventionId: id,
        });
      }

      const newDate = dto.dateOperation ? new Date(dto.dateOperation) : null;

      // Si geom fournie, on valide + recalcule la surface (la valeur
      // saisie est ignorée comme à la création). Cap à la surface
      // déclarée de la parcelle pour respecter l'autorité cadastrale
      // même quand la géom est plus large (cf 2026-05-08).
      let surfaceFromGeom: number | undefined;
      if (dto.geomGeoJson) {
        const measure = await this.validateAndMeasureSubzone(dto.geomGeoJson, existing.parcelleId);
        const surfaceParcelleM2 = Number(existing.parcelle?.surfaceM2 ?? 0);
        const ratio =
          surfaceParcelleM2 > 0 &&
          measure.geomParcelleAreaM2 !== null &&
          measure.geomParcelleAreaM2 > 0
            ? surfaceParcelleM2 / measure.geomParcelleAreaM2
            : 1;
        surfaceFromGeom = measure.rawAreaM2 * ratio;
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
      WHERE ${conditions.join(" AND ")}
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
      // Fabien 2026-05-14 (image 30) : un utilisateur recevait HTTP 404
      // sur la suppression alors qu'il voyait bien l'intervention dans
      // sa liste — la liste filtre par OR(ownerTenantId, authorTenantId)
      // tandis que remove() ne filtrait que par ownerTenantId. Cas
      // typique : une intervention saisie via le compte démo public.
      // On aligne le filtre de suppression sur celui de la liste.
      const existing = await tx.intervention.findFirst({
        where: {
          id,
          OR: [{ ownerTenantId: tenantId }, { authorTenantId: tenantId }],
        },
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
