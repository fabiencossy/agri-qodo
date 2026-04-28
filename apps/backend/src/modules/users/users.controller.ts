import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import type { JwtPayload } from "@/modules/auth/types/jwt-payload.type";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Liste des utilisateurs de l'exploitation." })
  list() {
    return this.service.list();
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Crée un utilisateur (OWNER uniquement)." })
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = req.user as JwtPayload;
    return this.service.create(user.role, dto);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Met à jour un utilisateur. OWNER pour les autres, self pour son compte.",
  })
  update(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    const user = req.user as JwtPayload;
    return this.service.update(user.role, user.sub, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    const user = req.user as JwtPayload;
    return this.service.remove(user.role, user.sub, id);
  }
}
