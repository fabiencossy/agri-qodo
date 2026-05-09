/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateProjetDto, UpdateProjetDto } from "./dto/projet.dto";
import { OdooProjetsSyncService } from "./odoo-projets-sync.service";

@Injectable()
export class ProjetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly odooSync: OdooProjetsSyncService,
  ) {}

  /** Pull manuel depuis Odoo (endpoint POST /projets/sync). */
  async syncFromOdoo() {
    const ctx = this.tenantContext.get();
    return this.odooSync.pullFromOdoo(ctx.tenantId);
  }

  /** Liste les projets du tenant. Par défaut on filtre les archivés. */
  async list(filters?: { includeArchived?: boolean; type?: string }) {
    const ctx = this.tenantContext.get();
    const where: Prisma.ProjetWhereInput = { tenantId: ctx.tenantId };
    if (!filters?.includeArchived) where.archive = false;
    if (filters?.type) where.type = filters.type as never;
    return this.prisma.projet.findMany({
      where,
      orderBy: [{ archive: "asc" }, { nom: "asc" }],
    });
  }

  async getById(id: string) {
    const ctx = this.tenantContext.get();
    const projet = await this.prisma.projet.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!projet) throw new NotFoundException("Projet introuvable");
    return projet;
  }

  async create(dto: CreateProjetDto) {
    const ctx = this.tenantContext.get();
    let created;
    try {
      created = await this.prisma.projet.create({
        data: {
          tenantId: ctx.tenantId,
          nom: dto.nom.trim(),
          ...(dto.description ? { description: dto.description } : {}),
          ...(dto.type ? { type: dto.type } : {}),
          ...(dto.couleurHex ? { couleurHex: dto.couleurHex } : {}),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Un projet "${dto.nom}" existe déjà.`);
      }
      throw err;
    }
    // Push best-effort vers Odoo (project.project create) — l'odooProjectId
    // sera posé en arrière-plan, sans bloquer la réponse au client.
    void this.odooSync.pushCreate(ctx.tenantId, created.id);
    return created;
  }

  async update(id: string, dto: UpdateProjetDto) {
    const ctx = this.tenantContext.get();
    const existing = await this.prisma.projet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, nom: true, archive: true, odooProjectId: true },
    });
    if (!existing) throw new NotFoundException("Projet introuvable");
    let updated;
    try {
      updated = await this.prisma.projet.update({
        where: { id },
        data: {
          ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description || null } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.couleurHex !== undefined ? { couleurHex: dto.couleurHex || null } : {}),
          ...(dto.archive !== undefined ? { archive: dto.archive } : {}),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Un projet avec ce nom existe déjà.`);
      }
      throw err;
    }

    // Push best-effort vers Odoo. Si l'odooProjectId n'existait pas (pull
    // jamais fait + push initial échoué), on tente un pushCreate.
    if (!existing.odooProjectId) {
      void this.odooSync.pushCreate(ctx.tenantId, updated.id);
    } else {
      const changes: { nom?: string; archive?: boolean } = {};
      if (dto.nom !== undefined && dto.nom.trim() !== existing.nom) changes.nom = dto.nom.trim();
      if (dto.archive !== undefined && dto.archive !== existing.archive)
        changes.archive = dto.archive;
      if (Object.keys(changes).length > 0) {
        void this.odooSync.pushUpdate(ctx.tenantId, updated.id, changes);
      }
    }
    return updated;
  }

  async remove(id: string) {
    const ctx = this.tenantContext.get();
    const projet = await this.prisma.projet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, odooProjectId: true },
    });
    if (!projet) throw new NotFoundException("Projet introuvable");
    await this.prisma.projet.delete({ where: { id } });
    // Côté Odoo, on archive plutôt que delete (FK : tasks, timesheets,
    // sale.order.line peuvent référencer le projet — un delete violerait
    // les contraintes).
    if (projet.odooProjectId) {
      void this.odooSync.pushArchive(ctx.tenantId, projet.odooProjectId);
    }
  }
}
