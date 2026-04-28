import { PartialType } from "@nestjs/swagger";
import { CreateParcelleDto } from "./create-parcelle.dto";

export class UpdateParcelleDto extends PartialType(CreateParcelleDto) {}
