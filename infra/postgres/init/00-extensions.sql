-- Extensions Postgres requises par Agri Qodo.
-- Exécuté au premier démarrage du conteneur Postgres (volume vide).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
