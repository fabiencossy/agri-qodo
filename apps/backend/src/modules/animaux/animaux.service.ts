import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type AnimalUgbInput,
  type BdtaImportRow,
  calculerUgbExploitation,
  parseBdtaCsv,
  type UgbExploitationResult,
} from "@agri-qodo/domain";
import { type AnimalCategorie, Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateAnimalDto } from "./dto/create-animal.dto";
import type { CreateAnimauxBatchDto } from "./dto/create-animaux-batch.dto";
import type { IdentifierAnimalDto } from "./dto/identifier-animal.dto";
import type { ImportBdtaDto, ImportBdtaResult } from "./dto/import-bdta.dto";
import type { UpdateAnimalDto } from "./dto/update-animal.dto";

/** Catégories pour lesquelles un n° de boucle BDTA a du sens (bovins). */
const CATEGORIES_BOVINES: ReadonlySet<AnimalCategorie> = new Set([
  "VACHE_LAITIERE",
  "GENISSE",
  "VEAU",
  "TAUREAU",
  "BOEUF",
  "AUTRE_BOVIN",
]);

export interface ListAnimauxOptions {
  categorie?: AnimalCategorie;
  /** true = avec n° boucle ou nom ou date de naissance ; false = strictement anonymes. */
  identified?: boolean;
}

@Injectable()
export class AnimauxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list(options: ListAnimauxOptions = {}) {
    const where: Prisma.AnimalWhereInput = { isActive: true };
    if (options.categorie) {
      where.categorie = options.categorie;
    }
    if (options.identified === true) {
      where.OR = [
        { numeroBoucle: { not: null } },
        { nom: { not: null } },
        { dateNaissance: { not: null } },
      ];
    } else if (options.identified === false) {
      where.numeroBoucle = null;
      where.nom = null;
      where.dateNaissance = null;
    }
    return this.prisma.tenantAware.animal.findMany({
      where,
      orderBy: [{ categorie: "asc" }, { numeroBoucle: "asc" }, { createdAt: "asc" }],
      take: 5000,
    });
  }

  /** Effectif groupé par catégorie : utile pour la vue liste + Suisse-Bilanz UI. */
  async summary(): Promise<Array<{ categorie: AnimalCategorie; nombreActifs: number }>> {
    const groupes = await this.prisma.tenantAware.animal.groupBy({
      by: ["categorie"],
      where: { isActive: true },
      _count: { _all: true },
    });
    return groupes
      .map((g) => ({ categorie: g.categorie, nombreActifs: g._count._all }))
      .sort((a, b) => b.nombreActifs - a.nombreActifs);
  }

  /**
   * Catégories animales effectivement présentes (≥ 1 animal actif). Le
   * frontend les utilise pour ne proposer dans les formulaires (SRPA, etc.)
   * que les catégories pertinentes pour l'exploitation.
   */
  async categoriesActives(): Promise<AnimalCategorie[]> {
    const summary = await this.summary();
    return summary.filter((s) => s.nombreActifs > 0).map((s) => s.categorie);
  }

  /**
   * UGB exploitation : coefficients officiels OPD-CH-2026 par catégorie,
   * affinés par date de naissance pour les bovins identifiés. Source unique
   * pour l'affichage cheptel, les contrôles SRPA/SST et la charge UGB/SAU.
   */
  async ugbSummary(): Promise<UgbExploitationResult> {
    const animaux = await this.prisma.tenantAware.animal.findMany({
      where: { isActive: true },
      select: { categorie: true, dateNaissance: true },
    });
    const input: AnimalUgbInput[] = animaux.map((a) => ({
      categorie: a.categorie,
      dateNaissance: a.dateNaissance,
    }));
    return calculerUgbExploitation(input);
  }

  async getById(id: string) {
    const animal = await this.prisma.tenantAware.animal.findFirst({ where: { id } });
    if (!animal) throw new NotFoundException("Animal introuvable");
    return animal;
  }

  async create(dto: CreateAnimalDto) {
    const { tenantId } = this.tenantContext.get();
    try {
      return await this.prisma.tenantAware.animal.create({
        data: {
          tenantId,
          categorie: dto.categorie,
          nom: dto.nom ?? null,
          numeroBoucle: dto.numeroBoucle ?? null,
          dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
          lotId: dto.lotId ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Ce numéro de boucle BDTA existe déjà");
      }
      throw err;
    }
  }

  /**
   * Identifie un bovin : promeut un row anonyme de la même catégorie
   * (sans n° boucle ni nom ni date naissance) pour préserver l'effectif
   * total. Si aucun anonyme, crée un nouveau row identifié (incrémente
   * l'effectif). Refuse les catégories non bovines (porc, poulet…) :
   * pas de n° BDTA pour celles-là.
   */
  async identifier(dto: IdentifierAnimalDto) {
    if (!CATEGORIES_BOVINES.has(dto.categorie)) {
      throw new ConflictException(
        "Le n° de boucle BDTA n'est applicable qu'aux bovins (vache, génisse, veau, taureau, bœuf).",
      );
    }
    const { tenantId } = this.tenantContext.get();
    const dateNaissance = dto.dateNaissance ? new Date(dto.dateNaissance) : null;
    const nom = dto.nom?.trim() || null;
    const numeroBoucle = dto.numeroBoucle.trim();

    // Cherche un anonyme à promouvoir.
    const anonyme = await this.prisma.tenantAware.animal.findFirst({
      where: {
        categorie: dto.categorie,
        isActive: true,
        numeroBoucle: null,
        nom: null,
        dateNaissance: null,
      },
      orderBy: { createdAt: "asc" },
    });

    try {
      if (anonyme) {
        return await this.prisma.tenantAware.animal.update({
          where: { id: anonyme.id },
          data: { numeroBoucle, nom, dateNaissance },
        });
      }
      return await this.prisma.tenantAware.animal.create({
        data: { tenantId, categorie: dto.categorie, numeroBoucle, nom, dateNaissance },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Ce numéro de boucle BDTA existe déjà");
      }
      throw err;
    }
  }

  /**
   * Import d'un export CSV BDTA / Agate. Pour chaque ligne du CSV :
   *   - n° boucle déjà présent en base → update (refresh sexe/âge)
   *   - n° boucle inconnu, anonyme dispo de la même catégorie → promote
   *   - sinon → create
   * Préserve l'effectif total quand on a déjà saisi le compteur. Réservé
   * aux bovins (la BDTA ne contient que des cloven-hoofed).
   */
  async importBdta(dto: ImportBdtaDto): Promise<ImportBdtaResult> {
    const parsed = parseBdtaCsv(dto.csv);
    const result: ImportBdtaResult = {
      created: 0,
      updated: 0,
      promoted: 0,
      skipped: parsed.errors.length,
      errors: parsed.errors.map((e) => ({ ligne: e.ligne, raison: e.raison })),
    };

    if (parsed.rows.length === 0) {
      return result;
    }

    const { tenantId } = this.tenantContext.get();

    // Toutes les opérations dans une transaction pour cohérence.
    await this.prisma.$transaction(async (tx) => {
      const tenantTx = tx.animal;
      for (const row of parsed.rows) {
        try {
          await this.applyBdtaRow(tenantTx, tenantId, row, result);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            result.skipped++;
            result.errors.push({
              ligne: row.ligne,
              raison: `n° boucle ${row.numeroBoucle} déjà utilisé sur une autre exploitation`,
            });
          } else {
            throw err;
          }
        }
      }
    });

    return result;
  }

  private async applyBdtaRow(
    tenantTx: Prisma.AnimalDelegate,
    tenantId: string,
    row: BdtaImportRow,
    result: ImportBdtaResult,
  ): Promise<void> {
    const existing = await tenantTx.findFirst({
      where: { tenantId, numeroBoucle: row.numeroBoucle },
    });

    if (existing) {
      const updates: Prisma.AnimalUpdateInput = {};
      if (existing.categorie !== row.categorie) updates.categorie = row.categorie;
      if (row.dateNaissance && !existing.dateNaissance) {
        updates.dateNaissance = row.dateNaissance;
      }
      if (row.nom && !existing.nom) updates.nom = row.nom;
      if (Object.keys(updates).length > 0) {
        await tenantTx.update({ where: { id: existing.id }, data: updates });
      }
      result.updated++;
      return;
    }

    // Pas d'existant — promouvoir un anonyme de la même catégorie si dispo.
    const anonyme = await tenantTx.findFirst({
      where: {
        tenantId,
        categorie: row.categorie,
        isActive: true,
        numeroBoucle: null,
        nom: null,
        dateNaissance: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (anonyme) {
      await tenantTx.update({
        where: { id: anonyme.id },
        data: {
          numeroBoucle: row.numeroBoucle,
          nom: row.nom,
          dateNaissance: row.dateNaissance,
        },
      });
      result.promoted++;
      return;
    }

    await tenantTx.create({
      data: {
        tenantId,
        categorie: row.categorie,
        numeroBoucle: row.numeroBoucle,
        nom: row.nom,
        dateNaissance: row.dateNaissance,
      },
    });
    result.created++;
  }

  /**
   * Saisie rapide pour cheptel non identifié individuellement (porcs,
   * poulets, autres bovins en groupe). Crée N rows Animal sans nom ni boucle.
   */
  async createBatch(dto: CreateAnimauxBatchDto) {
    const { tenantId } = this.tenantContext.get();
    const result = await this.prisma.tenantAware.animal.createMany({
      data: Array.from({ length: dto.nombre }, () => ({
        tenantId,
        categorie: dto.categorie,
      })),
    });
    return { created: result.count, categorie: dto.categorie };
  }

  async update(id: string, dto: UpdateAnimalDto) {
    const result = await this.prisma.tenantAware.animal.updateMany({
      where: { id },
      data: {
        ...(dto.categorie !== undefined ? { categorie: dto.categorie } : {}),
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.numeroBoucle !== undefined ? { numeroBoucle: dto.numeroBoucle } : {}),
        ...(dto.dateNaissance !== undefined
          ? { dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null }
          : {}),
        ...(dto.lotId !== undefined ? { lotId: dto.lotId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    if (result.count === 0) throw new NotFoundException("Animal introuvable");
    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.prisma.tenantAware.animal.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException("Animal introuvable");
  }

  /**
   * Définit l'effectif total d'une catégorie. Calcule le delta vs l'effectif
   * actuel et crée ou supprime les rows nécessaires. Pattern UI naturel :
   * "j'ai 25 vaches laitières" plutôt que "+24" ou "-1".
   */
  async setEffectif(categorie: AnimalCategorie, total: number) {
    if (!Number.isInteger(total) || total < 0 || total > 100000) {
      throw new ConflictException("Effectif invalide");
    }
    const { tenantId } = this.tenantContext.get();
    const current = await this.prisma.tenantAware.animal.count({
      where: { categorie, isActive: true },
    });
    const delta = total - current;
    if (delta === 0) return { categorie, total, delta: 0 };
    if (delta > 0) {
      await this.prisma.tenantAware.animal.createMany({
        data: Array.from({ length: delta }, () => ({ tenantId, categorie })),
      });
      return { categorie, total, delta };
    }
    // delta < 0 : on retire les |delta| plus récents non identifiés
    // (sans nom ni n° boucle) en priorité, pour préserver les bovins suivis.
    const candidats = await this.prisma.tenantAware.animal.findMany({
      where: { categorie, isActive: true, nom: null, numeroBoucle: null },
      orderBy: { createdAt: "desc" },
      take: -delta,
      select: { id: true },
    });
    if (candidats.length < -delta) {
      // pas assez d'anonymes — on complète sur les autres (les plus récents).
      const more = await this.prisma.tenantAware.animal.findMany({
        where: {
          categorie,
          isActive: true,
          id: { notIn: candidats.map((c) => c.id) },
        },
        orderBy: { createdAt: "desc" },
        take: -delta - candidats.length,
        select: { id: true },
      });
      candidats.push(...more);
    }
    await this.prisma.tenantAware.animal.deleteMany({
      where: { id: { in: candidats.map((c) => c.id) } },
    });
    return { categorie, total, delta };
  }

  /** Suppression batch : retire `nombre` derniers animaux d'une catégorie. */
  async removeBatch(categorie: AnimalCategorie, nombre: number): Promise<{ deleted: number }> {
    if (!Number.isInteger(nombre) || nombre <= 0) {
      throw new ConflictException("Nombre invalide");
    }
    // Sélection sans tenantId explicite — l'extension Prisma l'injecte.
    const ids = await this.prisma.tenantAware.animal.findMany({
      where: { categorie, isActive: true },
      orderBy: { createdAt: "desc" },
      take: nombre,
      select: { id: true },
    });
    if (ids.length === 0) return { deleted: 0 };
    const result = await this.prisma.tenantAware.animal.deleteMany({
      where: { id: { in: ids.map((a) => a.id) } },
    });
    return { deleted: result.count };
  }
}
