import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

/**
 * Module Users — gestion des comptes utilisateurs au sein d'une
 * exploitation (tenant).
 *
 * Seuls les utilisateurs OWNER peuvent créer/modifier d'autres comptes
 * dans leur exploitation. Les autres rôles ont un accès lecture-seule
 * (pour lister leurs collègues notamment).
 *
 * Le User n'est pas dans TENANT_SCOPED_MODELS_LC (seul `tenantId` y
 * vit, mais le filtrage se fait manuellement pour permettre les jointures
 * en lecture cross-tenant via PartnerLink M16).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list() {
    const { tenantId } = this.tenantContext.get();
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
  }

  async getById(id: string) {
    const { tenantId } = this.tenantContext.get();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException("Utilisateur introuvable");
    return user;
  }

  async create(callerRole: UserRole, dto: CreateUserDto) {
    if (callerRole !== UserRole.OWNER) {
      throw new ForbiddenException("Seul le propriétaire peut ajouter des utilisateurs");
    }
    const { tenantId } = this.tenantContext.get();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          prenom: dto.prenom,
          nom: dto.nom,
          role: dto.role ?? UserRole.EMPLOYE,
          tenantId,
        },
        select: {
          id: true,
          email: true,
          prenom: true,
          nom: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Cet email est déjà utilisé");
      }
      throw err;
    }
  }

  async update(callerRole: UserRole, callerUserId: string, id: string, dto: UpdateUserDto) {
    const { tenantId } = this.tenantContext.get();
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("Utilisateur introuvable");

    // Permissions :
    //   - OWNER peut tout modifier sur tout user du tenant.
    //   - Un non-OWNER ne peut modifier que son propre compte (et pas son
    //     rôle ni isActive — uniquement nom/prenom/password).
    const isSelf = id === callerUserId;
    if (callerRole !== UserRole.OWNER) {
      if (!isSelf) {
        throw new ForbiddenException("Modification interdite");
      }
      if (dto.role !== undefined || dto.isActive !== undefined) {
        throw new ForbiddenException("Seul le propriétaire peut changer rôle / activation");
      }
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.prenom !== undefined ? { prenom: dto.prenom } : {}),
      ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
    };

    await this.prisma.user.update({ where: { id }, data });

    // Si on désactive ou change le mdp d'un user, on invalide ses
    // refresh tokens pour le forcer à se reconnecter.
    if (dto.isActive === false || dto.password) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return this.getById(id);
  }

  async remove(callerRole: UserRole, callerUserId: string, id: string): Promise<void> {
    if (callerRole !== UserRole.OWNER) {
      throw new ForbiddenException("Seul le propriétaire peut supprimer des utilisateurs");
    }
    if (id === callerUserId) {
      throw new ForbiddenException("Vous ne pouvez pas supprimer votre propre compte");
    }
    const { tenantId } = this.tenantContext.get();
    const result = await this.prisma.user.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) throw new NotFoundException("Utilisateur introuvable");
  }
}
