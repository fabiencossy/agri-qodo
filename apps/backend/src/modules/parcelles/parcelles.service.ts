import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateParcelleDto, GeoJsonGeometry } from "./dto/create-parcelle.dto";
import type { UpdateParcelleDto } from "./dto/update-parcelle.dto";

interface ParcelleMapRow {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: string;
  geom: string | null; // GeoJSON sérialisé par ST_AsGeoJSON
}

export interface ParcelleMapItem {
  id: string;
  nom: string;
  surfaceM2: string;
  zone: string;
  geom: GeoJsonGeometry | null;
}

@Injectable()
export class ParcellesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list() {
    return this.prisma.tenantAware.parcelle.findMany({
      orderBy: { nom: "asc" },
    });
  }

  /**
   * Variante carte : retourne id, nom, surface, zone et géométrie
   * sérialisée en GeoJSON. Filtre tenant manuel via tenantContext (le
   * raw query ne passe pas par l'extension Prisma).
   */
  async listForMap(): Promise<ParcelleMapItem[]> {
    const { tenantId } = this.tenantContext.get();
    const rows = await this.prisma.$queryRaw<ParcelleMapRow[]>`
      SELECT
        id,
        nom,
        surface_m2::text AS "surfaceM2",
        zone::text AS zone,
        ST_AsGeoJSON(geom) AS geom
      FROM parcelles
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY nom ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      surfaceM2: r.surfaceM2,
      zone: r.zone,
      geom: r.geom ? (JSON.parse(r.geom) as GeoJsonGeometry) : null,
    }));
  }

  async getById(id: string) {
    const parcelle = await this.prisma.tenantAware.parcelle.findFirst({
      where: { id },
    });
    if (!parcelle) {
      throw new NotFoundException("Parcelle introuvable");
    }
    return parcelle;
  }

  /**
   * Création en 2 étapes : d'abord Prisma create (avec tenantId injecté
   * par l'extension), puis $executeRaw UPDATE pour poser la géométrie
   * PostGIS si fournie.
   */
  async create(data: CreateParcelleDto) {
    const { geomGeoJson, ...rest } = data;
    const parcelle = await this.prisma.tenantAware.parcelle.create({
      data: rest as unknown as Prisma.ParcelleUncheckedCreateInput,
    });

    if (geomGeoJson) {
      await this.prisma.$executeRaw`
        UPDATE parcelles
        SET geom = ST_Multi(ST_GeomFromGeoJSON(${JSON.stringify(geomGeoJson)}))::geometry(MultiPolygon, 4326)
        WHERE id = ${parcelle.id}::uuid
      `;
    }

    return parcelle;
  }

  async update(id: string, data: UpdateParcelleDto) {
    const { geomGeoJson, ...rest } = data;
    const result = await this.prisma.tenantAware.parcelle.updateMany({
      where: { id },
      data: rest,
    });
    if (result.count === 0) {
      throw new NotFoundException("Parcelle introuvable");
    }
    if (geomGeoJson !== undefined) {
      const { tenantId } = this.tenantContext.get();
      await this.prisma.$executeRaw`
        UPDATE parcelles
        SET geom = ST_Multi(ST_GeomFromGeoJSON(${JSON.stringify(geomGeoJson)}))::geometry(MultiPolygon, 4326)
        WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      `;
    }
    return this.getById(id);
  }

  async remove(id: string) {
    const result = await this.prisma.tenantAware.parcelle.deleteMany({
      where: { id },
    });
    if (result.count === 0) {
      throw new NotFoundException("Parcelle introuvable");
    }
  }
}
