/**
 * Extension Prisma — multi-tenant strict.
 *
 * Pour chaque modèle listé dans TENANT_SCOPED_MODELS, l'extension :
 *   - injecte `where.tenantId = current` sur findFirst/findMany/count/aggregate
 *     /groupBy/updateMany/deleteMany
 *   - injecte `data.tenantId = current` sur create/createMany/upsert
 *   - throw si l'appelant force un `tenantId` différent (tentative
 *     d'écriture/lecture cross-tenant)
 *   - **interdit findUnique/findUniqueOrThrow** (par défaut Prisma exige une
 *     clé unique sur `where` — incompatible avec l'injection d'un filtre
 *     `tenantId`). Les services doivent utiliser `findFirst({ where: { id } })`,
 *     le filtre `tenantId` est ajouté automatiquement.
 *   - **update/delete unitaires non gérés** par l'extension (Prisma exige une
 *     clé unique sur `where`). Les services doivent passer par
 *     `updateMany({ where: { id, ... }})` / `deleteMany`, ou faire un
 *     `findFirst` puis `update` après vérification.
 *
 * Modèles HORS du filtre auto (filtre manuel obligatoire) :
 *   - Exploitation       (le tenant lui-même)
 *   - User, RefreshToken (filtré par userId via JWT)
 *   - Intervention       (deux fields tenant : ownerTenantId + authorTenantId)
 *   - PartnerLink        (deux fields tenant : ownerTenantId + partnerTenantId)
 *
 * Si pas de contexte tenant (seed, requêtes publiques avant auth),
 * l'extension est transparente.
 *
 * Voir docs/adr/ADR-002-multi-tenant.md.
 */
import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { TenantContextService } from "../tenant/tenant-context.service";

const TENANT_SCOPED_MODELS = new Set<string>(["Parcelle", "Culture", "Animal", "LotAnimal"]);

const READ_OPS = new Set<string>([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_MANY_OPS = new Set<string>(["updateMany", "deleteMany"]);
const FORBIDDEN_OPS = new Set<string>(["findUnique", "findUniqueOrThrow"]);

type WhereLike = Record<string, unknown>;
type DataLike = Record<string, unknown>;
type Args = Record<string, unknown>;

function injectWhere(args: Args, tenantId: string): void {
  const where = (args.where as WhereLike | undefined) ?? {};
  if ("tenantId" in where && where.tenantId !== tenantId) {
    throw new ForbiddenException(
      `Lecture cross-tenant refusée : tenantId=${String(where.tenantId)} (contexte=${tenantId})`,
    );
  }
  args.where = { ...where, tenantId };
}

function ensureDataTenant(data: DataLike, expectedTenantId: string): DataLike {
  if ("tenantId" in data && data.tenantId !== expectedTenantId) {
    throw new ForbiddenException(
      `Écriture cross-tenant refusée : tenantId=${String(data.tenantId)} (contexte=${expectedTenantId})`,
    );
  }
  return { ...data, tenantId: expectedTenantId };
}

export function buildTenantExtension(tenantContext: TenantContextService) {
  return Prisma.defineExtension({
    name: "agri-qodo/tenant-aware",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = tenantContext.tryGet()?.tenantId;
          if (!tenantId || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (FORBIDDEN_OPS.has(operation)) {
            throw new Error(
              `${operation} sur ${model} interdit (modèle tenant-scoped). ` +
                `Utiliser findFirst({ where: { id, ... } }) — le filtre tenantId est injecté automatiquement.`,
            );
          }

          const mutableArgs = args as Args;

          if (READ_OPS.has(operation) || WRITE_MANY_OPS.has(operation)) {
            injectWhere(mutableArgs, tenantId);
          } else if (operation === "create") {
            const data = mutableArgs.data as DataLike | undefined;
            if (data) mutableArgs.data = ensureDataTenant(data, tenantId);
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = mutableArgs.data;
            if (Array.isArray(data)) {
              mutableArgs.data = (data as DataLike[]).map((d) => ensureDataTenant(d, tenantId));
            } else if (data && typeof data === "object") {
              mutableArgs.data = ensureDataTenant(data as DataLike, tenantId);
            }
          } else if (operation === "upsert") {
            injectWhere(mutableArgs, tenantId);
            const create = mutableArgs.create as DataLike | undefined;
            if (create) mutableArgs.create = ensureDataTenant(create, tenantId);
          }

          return query(args);
        },
      },
    },
  });
}

export const TENANT_AWARE_MODELS = TENANT_SCOPED_MODELS;
