/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateProjetDto, UpdateProjetDto } from "./dto/projet.dto";

@Injectable()
export class ProjetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

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
    try {
      return await this.prisma.projet.create({
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
  }

  async update(id: string, dto: UpdateProjetDto) {
    const ctx = this.tenantContext.get();
    const existing = await this.prisma.projet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Projet introuvable");
    try {
      return await this.prisma.projet.update({
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
  }

  async remove(id: string) {
    const ctx = this.tenantContext.get();
    const result = await this.prisma.projet.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });
    if (result.count === 0) throw new NotFoundException("Projet introuvable");
  }
}
