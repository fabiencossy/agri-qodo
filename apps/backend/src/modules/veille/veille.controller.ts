import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  getVeilleArticle,
  listVeilleCategories,
  searchVeille,
  type VeilleCategorie,
} from "@agri-qodo/domain";

const CATEGORIES: VeilleCategorie[] = ["OPD", "OPPh", "Lex", "Guide", "Glossaire", "Calendrier"];

@ApiTags("veille")
@Controller("veille")
export class VeilleController {
  @Get()
  @ApiOperation({
    summary: "Liste les articles de veille réglementaire. Filtres : ?categorie=OPD&q=phyto",
  })
  list(@Query("categorie") categorieRaw?: string, @Query("q") query?: string) {
    const categorie =
      categorieRaw && CATEGORIES.includes(categorieRaw as VeilleCategorie)
        ? (categorieRaw as VeilleCategorie)
        : undefined;
    const filter: { query?: string; categorie?: VeilleCategorie } = {};
    if (query) filter.query = query;
    if (categorie) filter.categorie = categorie;
    return searchVeille(undefined, filter).map(({ contenu: _contenu, ...rest }) => rest);
  }

  @Get("categories")
  @ApiOperation({ summary: "Catégories disponibles avec leur compte d'articles." })
  categories() {
    return listVeilleCategories();
  }

  @Get(":slug")
  @ApiOperation({ summary: "Détail d'un article (avec contenu markdown)." })
  getOne(@Param("slug") slug: string) {
    const article = getVeilleArticle(slug);
    if (!article) throw new NotFoundException("Article introuvable");
    return article;
  }
}
