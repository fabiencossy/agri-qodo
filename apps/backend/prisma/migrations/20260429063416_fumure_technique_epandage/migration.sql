-- CreateEnum
CREATE TYPE "TechniqueEpandage" AS ENUM ('EPANDEUR_CLASSIQUE', 'RAMPE_PENDILLARDE', 'TRAINEE_SOUPLE', 'INJECTION', 'FUMIER_SOLIDE');

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN     "technique_epandage" "TechniqueEpandage";
