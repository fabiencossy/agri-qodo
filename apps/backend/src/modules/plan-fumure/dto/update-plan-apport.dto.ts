import { OmitType, PartialType } from "@nestjs/swagger";
import { CreatePlanApportDto } from "./create-plan-apport.dto";

/**
 * Update : on n'autorise pas la modification de parcelle/campagne
 * (changement = nouveau plan).
 */
export class UpdatePlanApportDto extends PartialType(
  OmitType(CreatePlanApportDto, ["parcelleId", "campagne"] as const),
) {}
