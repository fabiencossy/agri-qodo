import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/common/prisma/prisma.service";
import { AuthService } from "./auth.service";
import { AuthTokensDto } from "./dto/auth-tokens.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
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
}
