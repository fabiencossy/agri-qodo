import type { UserRole } from "@prisma/client";

export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  email: string;
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  tokenId: string; // ID du RefreshToken pour pouvoir le révoquer
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
