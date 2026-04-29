import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateInterventionDto } from "./create-intervention.dto";

/**
 * Update : on n'autorise pas la modification du clientUuid (immuable
 * pour l'idempotence sync), de la parcelle (changement = nouvelle
 * intervention), du type, ni du produit. Ces 2 derniers gouvernent
 * la création de Culture lors d'un SEMIS — modifier nécessite de
 * supprimer/recréer pour garantir la cohérence carnet ↔ assolement.
 */
export class UpdateInterventionDto extends PartialType(
  OmitType(CreateInterventionDto, ["clientUuid", "parcelleId", "type", "produitId"] as const),
) {}
