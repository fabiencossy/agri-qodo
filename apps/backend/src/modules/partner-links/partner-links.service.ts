import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type PartnerLink, PartnerLinkLevel, PartnerLinkStatus, Prisma } from "@prisma/client";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { CreatePartnerLinkDto, PartnerLinkScopeDto } from "./dto/create-partner-link.dto";

/** Vue enrichie d'un lien — UI a besoin du nom + code de l'autre exploitation. */
export interface PartnerLinkView {
  id: string;
  status: PartnerLinkStatus;
  niveau: PartnerLinkLevel;
  scope: PartnerLinkScopeDto;
  /** "owner" si je suis l'exploitation propriétaire, "partner" sinon. */
  role: "owner" | "partner";
  partner: {
    id: string;
    nom: string;
    code: string;
    canton: string;
  };
  createdAt: Date;
  grantedAt: Date | null;
  revokedAt: Date | null;
}

const DEFAULT_SCOPE: PartnerLinkScopeDto = {
  parcelles: "all",
  niveau: PartnerLinkLevel.DIRECT,
};

@Injectable()
export class PartnerLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(tenantId: string): Promise<PartnerLinkView[]> {
    const links = await this.prisma.partnerLink.findMany({
      where: {
        OR: [{ ownerTenantId: tenantId }, { partnerTenantId: tenantId }],
      },
      include: {
        ownerTenant: { select: { id: true, nom: true, code: true, canton: true } },
        partnerTenant: { select: { id: true, nom: true, code: true, canton: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return links.map((l) => this.toView(l, tenantId));
  }

  async lookupByCode(code: string, tenantId: string) {
    const tenant = await this.prisma.exploitation.findUnique({
      where: { code },
      select: { id: true, nom: true, code: true, canton: true },
    });
    if (!tenant) throw new NotFoundException("Aucune exploitation avec ce code Agri Qodo");
    if (tenant.id === tenantId) {
      throw new BadRequestException("Tu ne peux pas te lier à toi-même");
    }
    return tenant;
  }

  async invite(ownerTenantId: string, dto: CreatePartnerLinkDto): Promise<PartnerLinkView> {
    const partner = await this.lookupByCode(dto.partnerCode, ownerTenantId);
    const scope = dto.scope ?? DEFAULT_SCOPE;
    try {
      const created = await this.prisma.partnerLink.create({
        data: {
          ownerTenantId,
          partnerTenantId: partner.id,
          status: PartnerLinkStatus.PENDING,
          niveau: scope.niveau,
          scope: scope as unknown as Prisma.InputJsonValue,
        },
        include: {
          ownerTenant: { select: { id: true, nom: true, code: true, canton: true } },
          partnerTenant: { select: { id: true, nom: true, code: true, canton: true } },
        },
      });
      return this.toView(created, ownerTenantId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Un lien partenaire existe déjà avec cette exploitation");
      }
      throw err;
    }
  }

  async accept(linkId: string, tenantId: string): Promise<PartnerLinkView> {
    const link = await this.getOrThrow(linkId);
    if (link.partnerTenantId !== tenantId) {
      throw new ForbiddenException("Seul le partenaire invité peut accepter cette demande");
    }
    if (link.status !== PartnerLinkStatus.PENDING) {
      throw new ConflictException("Ce lien n'est plus en attente de validation");
    }
    const updated = await this.prisma.partnerLink.update({
      where: { id: linkId },
      data: { status: PartnerLinkStatus.ACTIVE, grantedAt: new Date() },
      include: {
        ownerTenant: { select: { id: true, nom: true, code: true, canton: true } },
        partnerTenant: { select: { id: true, nom: true, code: true, canton: true } },
      },
    });
    return this.toView(updated, tenantId);
  }

  /**
   * Révoque ou refuse un lien. Le owner peut révoquer un actif ou
   * annuler un pending qu'il a émis ; le partner peut refuser un pending
   * ou révoquer son consentement à tout moment.
   */
  async revoke(linkId: string, tenantId: string): Promise<PartnerLinkView> {
    const link = await this.getOrThrow(linkId);
    if (link.ownerTenantId !== tenantId && link.partnerTenantId !== tenantId) {
      throw new ForbiddenException("Tu n'es pas partie prenante de ce lien");
    }
    if (link.status === PartnerLinkStatus.REVOKED) {
      throw new ConflictException("Ce lien est déjà révoqué");
    }
    const updated = await this.prisma.partnerLink.update({
      where: { id: linkId },
      data: { status: PartnerLinkStatus.REVOKED, revokedAt: new Date() },
      include: {
        ownerTenant: { select: { id: true, nom: true, code: true, canton: true } },
        partnerTenant: { select: { id: true, nom: true, code: true, canton: true } },
      },
    });
    return this.toView(updated, tenantId);
  }

  private async getOrThrow(linkId: string): Promise<PartnerLink> {
    const link = await this.prisma.partnerLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException("Lien partenaire introuvable");
    return link;
  }

  private toView(
    link: PartnerLink & {
      ownerTenant: { id: string; nom: string; code: string; canton: string };
      partnerTenant: { id: string; nom: string; code: string; canton: string };
    },
    viewerTenantId: string,
  ): PartnerLinkView {
    const role: "owner" | "partner" = link.ownerTenantId === viewerTenantId ? "owner" : "partner";
    const partner = role === "owner" ? link.partnerTenant : link.ownerTenant;
    return {
      id: link.id,
      status: link.status,
      niveau: link.niveau,
      scope: link.scope as unknown as PartnerLinkScopeDto,
      role,
      partner,
      createdAt: link.createdAt,
      grantedAt: link.grantedAt,
      revokedAt: link.revokedAt,
    };
  }
}
