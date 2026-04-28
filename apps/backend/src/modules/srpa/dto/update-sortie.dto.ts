import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateSortieSrpaDto } from "./create-sortie.dto";

/** Update : on n'autorise pas le changement de date/catégorie (clé unique). */
export class UpdateSortieSrpaDto extends PartialType(
  OmitType(CreateSortieSrpaDto, ["date", "categorie"] as const),
) {}
