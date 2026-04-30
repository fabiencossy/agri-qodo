import { PartialType } from "@nestjs/swagger";
import { CreateTravailDto } from "./create-travail.dto";

/**
 * Update : on remplace toutes les lignes du travail (mode "edit total")
 * — c'est plus simple côté UI mobile que de gérer add/update/delete
 * granulaires. Le service efface puis re-crée les lignes en transaction.
 */
export class UpdateTravailDto extends PartialType(CreateTravailDto) {}
