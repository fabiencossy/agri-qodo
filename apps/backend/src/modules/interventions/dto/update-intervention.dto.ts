import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateInterventionDto } from "./create-intervention.dto";

/**
 * Update : on n'autorise pas la modification du clientUuid (immuable
 * pour l'idempotence sync) ni de la parcelle (changement = nouvelle
 * intervention).
 */
export class UpdateInterventionDto extends PartialType(
  OmitType(CreateInterventionDto, ["clientUuid", "parcelleId"] as const),
) {}
