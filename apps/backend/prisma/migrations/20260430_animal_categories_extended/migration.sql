-- Étend l'enum AnimalCategorie pour couvrir tous les élevages suisses
-- standard : ovins, caprins, équidés, cervidés, camélidés, volailles
-- détaillées, lapins, abeilles, etc. Coefficients UGB OPD-CH-2026 dans
-- packages/domain/src/ugb.ts.
--
-- ALTER TYPE ... ADD VALUE est idempotent depuis PG 12 grâce à IF NOT EXISTS.

-- Bovins
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'VACHE_ALLAITANTE';

-- Ovins
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'BREBIS';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'AGNEAU';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'BELIER';

-- Caprins
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'CHEVRE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'CABRI';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'BOUC';

-- Équidés
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'CHEVAL_ADULTE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'POULAIN';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'ANE';

-- Cervidés
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'CERF';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'DAIM';

-- Camélidés
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'LAMA';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'ALPAGA';

-- Porcs (détaillés)
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'TRUIE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'PORCELET';

-- Volailles
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'POULE_PONDEUSE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'DINDE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'OIE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'CANARD';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'PINTADE';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'CAILLE';

-- Petits élevages
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'LAPIN';
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'ABEILLE_RUCHE';

-- Autres
ALTER TYPE "AnimalCategorie" ADD VALUE IF NOT EXISTS 'BISON';
