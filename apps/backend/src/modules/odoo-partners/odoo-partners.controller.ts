/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Qodo SA
 */
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { OdooPartnersService, type OdooPartnerOut } from "./odoo-partners.service";

class CreateClientRapideDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ville?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  npa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  adresse?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;
}

@ApiTags("odoo-partners")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("odoo/partners")
export class OdooPartnersController {
  constructor(
    private readonly service: OdooPartnersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Liste les clients Odoo (res.partner customer_rank > 0) du tenant courant. Pour chaque client, indique s'il est lié à une Exploitation Agri Qodo (linkedExploitationId).",
  })
  list(): Promise<OdooPartnerOut[]> {
    const { tenantId } = this.tenantContext.get();
    return this.service.listClients(tenantId);
  }

  @Post()
  @ApiOperation({
    summary:
      "Création rapide d'un res.partner Odoo (sans Exploitation Agri Qodo). Décision Fabien 2026-05-06 : un client Odoo n'est PAS un partenaire — on stocke juste l'ID Odoo dans Travail.odooPartnerId.",
  })
  create(@Body() dto: CreateClientRapideDto) {
    const { tenantId } = this.tenantContext.get();
    return this.service.createQuickClient(tenantId, dto);
  }
}

@ApiTags("odoo-projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("odoo/projects")
export class OdooProjectsController {
  constructor(
    private readonly service: OdooPartnersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Sprint B prestations — liste les project.project Odoo actifs du tenant. Alimente les 3 sélecteurs de /parametres/exploitation (Travaux tiers / Carnet tiers / Carnet interne).",
  })
  list() {
    const { tenantId } = this.tenantContext.get();
    return this.service.listProjects(tenantId);
  }
}

@ApiTags("odoo-employees")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("odoo/employees")
export class OdooEmployeesController {
  constructor(
    private readonly service: OdooPartnersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Liste les hr.employee Odoo actifs du tenant. Alimente le select Employé Odoo sur /utilisateurs (mapping User.odooEmployeeId).",
  })
  list() {
    const { tenantId } = this.tenantContext.get();
    return this.service.listEmployees(tenantId);
  }
}
