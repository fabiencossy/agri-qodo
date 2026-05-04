/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";

export type AuditAction = "UPDATE" | "VALIDATE" | "REJECT" | "CANCEL" | "DELETE" | "PUSH_ODOO";

export type AuditEntityType =
  | "Travail"
  | "Intervention"
  | "Presence"
  | "Parcelle"
  | "Animal"
  | "PartnerLink";

interface RecordEditInput {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  /** Anciennes valeurs des champs touchés. */
  before?: Record<string, unknown>;
  /** Nouvelles valeurs. Le diff = champs où before[k] !== after[k]. */
  after?: Record<string, unknown>;
  /** Métadonnées libres : raison de refus, IP, user-agent… */
  meta?: Record<string, unknown>;
  /** Si fourni, override le tenantId du contexte (utile pour les actions
   *  cross-tenant comme la validation cas B). */
  tenantId?: string;
  /** Si fourni, override l'userId (utile quand l'action est déclenchée
   *  par un système et non un user authentifié). */
  userId?: string | null;
}

/**
 * Service d'audit générique. Persiste un enregistrement dans `edit_history`
 * pour chaque modification matérielle d'une entité auditable.
 *
 * Best-effort : un échec de l'audit ne doit JAMAIS bloquer la mutation
 * métier — on log un warning et on continue. Les audit logs LPD/nFADP
 * complets viendront en Mois 2 (rétention, signature, etc.).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async recordEdit(input: RecordEditInput): Promise<void> {
    const tenantId = input.tenantId ?? this.tenantContext.get().tenantId;
    const userId =
      input.userId === null ? null : (input.userId ?? this.tenantContext.get().userId ?? null);

    const diff = computeDiff(input.before, input.after);

    try {
      await this.prisma.editHistory.create({
        data: {
          tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          ...(userId ? { userId } : {}),
          action: input.action,
          ...(diff ? { diff: diff as Prisma.InputJsonValue } : {}),
          ...(input.meta ? { meta: input.meta as Prisma.InputJsonValue } : {}),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Audit log failed for ${input.entityType}#${input.entityId} (${input.action}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}

/**
 * Calcule le diff entre `before` et `after` : retourne un objet
 * `{ field: { old, new } }` pour les champs qui ont changé. Renvoie
 * null si rien n'a changé ou si on n'a pas de comparaison à faire.
 */
function computeDiff(
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> | null {
  if (!before || !after) return null;
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const oldValue = before[key];
    const newValue = after[key];
    if (!sameValue(oldValue, newValue)) {
      diff[key] = { old: oldValue ?? null, new: newValue ?? null };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === "string") return a.toISOString() === b;
  if (b instanceof Date && typeof a === "string") return b.toISOString() === a;
  // Decimal Prisma : sérialisé string. Compare via toString().
  if (
    (typeof a === "object" && a !== null && "toString" in a) ||
    (typeof b === "object" && b !== null && "toString" in b)
  ) {
    if (a == null || b == null) return a === b;
    return String(a) === String(b);
  }
  return false;
}
