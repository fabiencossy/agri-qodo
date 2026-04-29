import { Module } from "@nestjs/common";
import { VeilleController } from "./veille.controller";

/**
 * Module M15 — Veille réglementaire. Lecture publique (pas de
 * JwtAuthGuard) car prévu en plan Gratuit (canal d'acquisition).
 * Contenu statique versionné dans @agri-qodo/domain pour le moment.
 */
@Module({
  controllers: [VeilleController],
})
export class VeilleModule {}
