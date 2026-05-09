-- Source unique heures ↔ présences (2026-05-09).
-- Quand un Travail saisit une LigneTravailHeure (heureDebut + heureFin),
-- on crée automatiquement une Presence reliée. Le flag
-- `auto_from_heures` permet de re-supprimer/régénérer ces Presences à
-- la sync (l'update Travail "remplace tout" les lignes), sans toucher
-- aux Presences pointées manuellement via le clock-in.

ALTER TABLE "presences"
  ADD COLUMN "auto_from_heures" BOOLEAN NOT NULL DEFAULT false;
