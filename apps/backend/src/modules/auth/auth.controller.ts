import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/common/prisma/prisma.service";
import { AuthService } from "./auth.service";
import { AuthTokensDto } from "./dto/auth-tokens.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from "./dto/password-reset.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { JwtPayload } from "./types/jwt-payload.type";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Connexion par email + mot de passe. Le JWT inclut tous les tenants où ce couple matche (compte fédéré).",
  })
  login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Crée une nouvelle exploitation + utilisateur OWNER, et renvoie les tokens (login direct).",
  })
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.auth.register({
      email: dto.email,
      password: dto.password,
      prenom: dto.prenom,
      nom: dto.nom,
      exploitationNom: dto.exploitationNom,
      canton: dto.canton,
    });
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rotation des tokens (l'ancien refresh token est révoqué)",
  })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté." })
  async me(@CurrentUser() user: JwtPayload) {
    const profil = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, prenom: true, nom: true, role: true },
    });
    if (!profil) throw new Error("Utilisateur introuvable");
    return profil;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Déconnexion (révoque tous les refresh tokens)" })
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.logout(user.sub);
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Demande un reset password — envoie un mail avec un lien (1h, usage unique). Renvoie 204 même si l'email est inconnu pour ne pas leak l'existence d'un compte.",
  })
  async requestPasswordReset(
    @Req() req: Request,
    @Body() dto: RequestPasswordResetDto,
  ): Promise<void> {
    const ip = (req.headers["x-real-ip"] as string) ?? req.ip;
    const ua = req.headers["user-agent"];
    await this.auth.requestPasswordReset(dto.email, ip, ua);
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Confirme le reset avec le token reçu + nouveau mot de passe.",
  })
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto): Promise<void> {
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Changer son propre mot de passe (vérification du mot de passe actuel). Révoque les autres sessions.",
  })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
