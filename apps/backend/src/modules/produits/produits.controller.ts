import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ProduitCategorie } from "@prisma/client";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CreateProduitDto } from "./dto/create-produit.dto";
import { UpdateProduitDto } from "./dto/update-produit.dto";
import { OdooSyncService } from "./odoo-sync.service";
import { ProduitsService } from "./produits.service";

@ApiTags("produits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("produits")
export class ProduitsController {
  constructor(
    private readonly service: ProduitsService,
    private readonly odooSync: OdooSyncService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Liste les produits du catalogue (globaux + perso du tenant).",
  })
  @ApiQuery({ name: "categorie", required: false, enum: ProduitCategorie })
  list(
    @Query("categorie", new ParseEnumPipe(ProduitCategorie, { optional: true }))
    categorie?: ProduitCategorie,
  ) {
    return this.service.list(categorie);
  }

  @Get(":id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiOperation({ summary: "Crée un produit perso (tenant)." })
  create(@Body() dto: CreateProduitDto) {
    return this.service.create(dto);
  }

  @Post("sync-odoo")
  @ApiOperation({
    summary:
      "Synchronise le catalogue depuis Odoo (product.product). Admin uniquement. Crée les nouveaux + met à jour les existants par odooProductId.",
  })
  syncOdoo() {
    return this.odooSync.syncProduits();
  }

  @Post(":id/push-odoo")
  @ApiOperation({
    summary:
      "Garantit qu'un produit a un product.product Odoo associé (crée le produit type=consu si manquant). Renvoie l'odooProductId.",
  })
  pushOdoo(@Param("id", ParseUUIDPipe) id: string) {
    return this.odooSync.ensureOdooProduct(id).then((odooProductId) => ({ odooProductId }));
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Met à jour un produit perso. Les produits globaux sont read-only.",
  })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProduitDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
