import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { Env } from "@/config/env.schema";
import type { AuthTokens, JwtPayload, JwtRefreshPayload } from "./types/jwt-payload.type";

const REFRESH_TOKEN_BYTES = 64;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException("Refresh token invalide");
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.id !== payload.tokenId ||
      stored.revokedAt !== null ||
      stored.expiresAt <= new Date() ||
      !stored.user.isActive
    ) {
      throw new UnauthorizedException("Refresh token expiré ou révoqué");
    }

    // Rotation : révoque l'ancien et émet un nouveau couple
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({
      sub: stored.user.id,
      tenantId: stored.user.tenantId,
      email: stored.user.email,
      role: stored.user.role,
    });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get("JWT_SECRET", { infer: true }),
      expiresIn: this.config.get("JWT_EXPIRES_IN", { infer: true }),
    });

    const tokenId = randomBytes(16).toString("hex");
    const refreshPayload: JwtRefreshPayload = { sub: payload.sub, tokenId };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
      expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", { infer: true }),
    });

    const expiresAt = this.parseDuration(
      this.config.get("JWT_REFRESH_EXPIRES_IN", { infer: true }),
    );

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Très simple : "7d", "15m", "30s", "1h". Suffit pour notre usage.
   */
  private parseDuration(input: string): Date {
    const match = /^(\d+)([smhd])$/.exec(input);
    const valueStr = match?.[1];
    const unit = match?.[2] as "s" | "m" | "h" | "d" | undefined;
    if (!valueStr || !unit) {
      throw new Error(`Durée invalide : ${input}`);
    }
    const multipliers: Record<"s" | "m" | "h" | "d", number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + Number(valueStr) * multipliers[unit]);
  }

  /** Helper utilisé par le seed et les tests. */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  static readonly REFRESH_TOKEN_BYTES = REFRESH_TOKEN_BYTES;
}
