import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateAnimalDto } from "./create-animal.dto";

export class UpdateAnimalDto extends PartialType(CreateAnimalDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
