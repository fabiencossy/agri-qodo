import type { UserRole } from "@prisma/client";

export interface JwtPayload {
  sub: string; // userId du compte courant
  tenantId: string; // tenant courant (peut être basculé via switcher)
  email: string;
  role: UserRole;
  /**
   * Tenants accessibles par compte fédéré : tous les tenants où ce
   * couple email+password ouvre une session. Le switcher liste cette
   * collection ; X-Active-Tenant-Id doit y appartenir.
   */
  tenantIds: string[];
}

export interface JwtRefreshPayload {
  sub: string; // userId
  tokenId: string; // ID du RefreshToken pour pouvoir le révoquer
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
