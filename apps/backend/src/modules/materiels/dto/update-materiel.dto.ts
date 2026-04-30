import { PartialType } from "@nestjs/swagger";
import { CreateMaterielDto } from "./create-materiel.dto";

export class UpdateMaterielDto extends PartialType(CreateMaterielDto) {}
