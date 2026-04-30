import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { type Canton, Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { Env } from "@/config/env.schema";
import { MailerService } from "@/modules/mailer/mailer.service";
import type { AuthTokens, JwtPayload, JwtRefreshPayload } from "./types/jwt-payload.type";

const REFRESH_TOKEN_BYTES = 64;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Login fédéré : on cherche TOUS les Users avec cet email, et on
   * teste le mot de passe contre chacun. Tous les hashes qui matchent
   * désignent des comptes "fédérés" (même personne, plusieurs
   * exploitations). Le JWT inclut la liste de leurs tenantIds — le
   * tenant switcher peut basculer entre eux sans nouveau login.
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    const candidates = await this.prisma.user.findMany({
      where: { email, isActive: true },
    });
    const matched: typeof candidates = [];
    for (const u of candidates) {
      if (await bcrypt.compare(password, u.passwordHash)) {
        matched.push(u);
      }
    }
    if (matched.length === 0) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    // Le compte "principal" pour le JWT : on prend le plus récemment
    // utilisé (lastLoginAt desc) puis le plus ancien (createdAt asc).
    matched.sort((a, b) => {
      const al = a.lastLoginAt?.getTime() ?? 0;
      const bl = b.lastLoginAt?.getTime() ?? 0;
      if (al !== bl) return bl - al;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const primary = matched[0]!;
    const tenantIds = matched.map((u) => u.tenantId);

    await this.prisma.user.update({
      where: { id: primary.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens({
      sub: primary.id,
      tenantId: primary.tenantId,
      email: primary.email,
      role: primary.role,
      tenantIds,
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

    // Au refresh on n'a plus le mot de passe en clair → on ne peut
    // pas re-tester la fédération. On retombe sur le tenant courant ;
    // la fédération sera ré-établie au prochain login complet.
    return this.issueTokens({
      sub: stored.user.id,
      tenantId: stored.user.tenantId,
      email: stored.user.email,
      role: stored.user.role,
      tenantIds: [stored.user.tenantId],
    });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Change le mot de passe d'un user authentifié. Vérifie le password
   * courant avant de set le nouveau (sécurité). Révoque tous les
   * refresh tokens existants pour forcer une re-login partout.
   */
  /**
   * Génère un token de reset password, l'enregistre hashé et envoie le
   * mail. Retourne TOUJOURS success pour ne pas leak l'existence d'un
   * email (énumération de comptes).
   *
   * Si l'email matche plusieurs users (cas comptable multi-tenant), on
   * génère un token PAR user et on envoie 1 mail par user — l'utilisateur
   * choisit dans quel compte il veut reset.
   */
  async requestPasswordReset(email: string, ip?: string, userAgent?: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { email: email.trim().toLowerCase(), isActive: true },
      select: { id: true, email: true, prenom: true, tenantId: true },
    });
    if (users.length === 0) {
      // Pas d'erreur exposée — on log et on s'arrête.
      this.logger.warn(`Reset password demandé pour email inconnu : ${email}`);
      return;
    }

    const publicUrl = this.config.get("PUBLIC_APP_URL", { infer: true });
    for (const user of users) {
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          ...(ip ? { requestIp: ip } : {}),
          ...(userAgent ? { requestUa: userAgent.slice(0, 500) } : {}),
        },
      });

      const resetUrl = `${publicUrl}/reset-password?token=${rawToken}`;
      await this.mailer.send({
        to: user.email,
        subject: "Réinitialise ton mot de passe Agri Qodo",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #2d6a4f;">Bonjour ${user.prenom},</h2>
            <p>Tu as demandé à réinitialiser ton mot de passe Agri Qodo.</p>
            <p>Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.
            Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une fois.</p>
            <p style="margin: 32px 0;">
              <a href="${resetUrl}" style="background: #2d6a4f; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </p>
            <p style="font-size: 12px; color: #666;">
              Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :<br>
              <code style="word-break: break-all;">${resetUrl}</code>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
              Si tu n'as pas demandé cette réinitialisation, ignore ce mail.
              Ton mot de passe actuel reste valide.
            </p>
          </div>
        `,
      });
    }
  }

  /**
   * Confirme le reset : vérifie le token (hash, non expiré, non utilisé),
   * met à jour le mot de passe, marque le token comme consommé et révoque
   * tous les refresh tokens du user.
   */
  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException("Le nouveau mot de passe doit faire au moins 8 caractères");
    }
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Lien de réinitialisation invalide ou expiré");
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash: newHash },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      // Révoque toutes les sessions actives — l'utilisateur doit se
      // reconnecter avec son nouveau mot de passe partout.
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException("Utilisateur introuvable");
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Mot de passe actuel incorrect");
    }
    if (newPassword.length < 8) {
      throw new BadRequestException("Le nouveau mot de passe doit faire au moins 8 caractères");
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });
      // Révoque tous les refresh tokens — l'utilisateur garde son
      // accessToken courant mais devra re-login sur ses autres devices.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Création d'une nouvelle exploitation + utilisateur OWNER + login
   * direct. Sert au signup public depuis la landing.
   *
   * - Une transaction atomique : Exploitation + User créés ou rien.
   * - Code exploitation auto-généré format `AQ-{canton}-{token4}`.
   * - Conflit si l'email est déjà pris pour cette exploitation (= toujours,
   *   car nouvelle exploitation = aucun user existant à ce stade) — donc
   *   on garde l'erreur P2002 mappée en 409.
   */
  async register(input: {
    email: string;
    password: string;
    prenom: string;
    nom: string;
    exploitationNom: string;
    canton: Canton;
  }): Promise<AuthTokens> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const code = `AQ-${input.canton}-${randomBytes(2).toString("hex").toUpperCase()}`;

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const exploitation = await tx.exploitation.create({
          data: {
            code,
            nom: input.exploitationNom.trim(),
            canton: input.canton,
            emailContact: input.email.trim().toLowerCase(),
          },
        });
        return tx.user.create({
          data: {
            email: input.email.trim().toLowerCase(),
            passwordHash,
            prenom: input.prenom.trim(),
            nom: input.nom.trim(),
            role: UserRole.OWNER,
            tenantId: exploitation.id,
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(
          "Un compte existe déjà avec cet email pour cette exploitation.",
        );
      }
      throw err;
    }

    return this.issueTokens({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      tenantIds: [user.tenantId],
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
