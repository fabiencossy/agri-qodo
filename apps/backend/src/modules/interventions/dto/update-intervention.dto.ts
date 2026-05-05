import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateInterventionDto } from "./create-intervention.dto";

/**
 * Update : on n'autorise pas la modification du clientUuid (immuable
 * pour l'idempotence sync). Sprint 2 fusion-interventions : type,
 * parcelleId et produitId sont désormais modifiables — utile pour
 * compléter une pré-tâche planifiée (type=AUTRE par défaut). Le service
 * update gère la cohérence Culture pour les SEMIS.
 */
export class UpdateInterventionDto extends PartialType(
  OmitType(CreateInterventionDto, ["clientUuid"] as const),
) {}
