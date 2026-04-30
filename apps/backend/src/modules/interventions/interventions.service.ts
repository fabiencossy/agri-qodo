import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InterventionType, type Prisma, ProduitCategorie, ValidationStatus } from "@prisma/client";
import area from "@turf/area";
import { randomUUID } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
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
      select: { id: true, tenantId: true, surfaceM2: true },
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
          quantite: dto.quantite ?? null,
          unite: dto.unite ?? null,
          surfaceTravailleeM2: surfaceFinale,
          notes: dto.notes ?? null,
          techniqueEpandage: dto.techniqueEpandage ?? null,
          cultureId,
          validationStatus,
        },
        include: this.includeRelations,
      });

      if (dto.geomGeoJson) {
        await tx.$executeRawUnsafe(
          `UPDATE interventions
             SET geom = ST_GeomFromGeoJSON($1)::geometry(Polygon, 4326)
           WHERE id = $2::uuid`,
          JSON.stringify(dto.geomGeoJson),
          created.id,
        );
      }

      return created;
    });
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
                (SELECT geom FROM parcelles WHERE id = $2::uuid)
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
          ...(dto.produit !== undefined ? { produit: dto.produit } : {}),
          ...(dto.materielId !== undefined ? { materielId: dto.materielId || null } : {}),
          ...(dto.surfaceHa !== undefined ? { surfaceHa: dto.surfaceHa } : {}),
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
        },
      });

      if (dto.geomGeoJson !== undefined) {
        if (dto.geomGeoJson === null) {
          await tx.$executeRawUnsafe(
            `UPDATE interventions SET geom = NULL WHERE id = $1::uuid`,
            id,
          );
        } else {
          await tx.$executeRawUnsafe(
            `UPDATE interventions
               SET geom = ST_GeomFromGeoJSON($1)::geometry(Polygon, 4326)
             WHERE id = $2::uuid`,
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
