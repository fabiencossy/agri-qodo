# PRD — Fusion Interventions (v0.2)

**Date** : 2026-05-04
**Branche cible** : `feat/fusion-interventions` (à créer après validation finale)
**Statut** : ✅ Migration non destructive validée par Fabien — prêt pour Sprint 0
**Remplace** : PRD v0.1 (chat 2026-05-04)

> **Décision Fabien (2026-05-04)** : on **garde toutes les données existantes**.
> Le `prisma migrate reset` mentionné en v0.1 est **annulé**.
> Sprint 0 = vraie migration de données (mapping ancien→nouveau).

---

## 1. Objectif

Fusionner les 3 modules `Travail` (M6), `Intervention` (M2), `Presence` (M11) derrière **une seule porte d'entrée** dans l'app, tout en **conservant les modèles Prisma existants** comme socle (pas de table renommée, pas de drop).

**Principe v0.2** : on ne refait pas le schéma. On ajoute une couche d'agrégation + un écran unifié. Les 19 PRs livrées cette session sont préservées.

---

## 2. Reconnaissance de l'existant (différence vs PRD v0.1)

La v0.1 décrivait un schéma "from scratch". La réalité prod (newagri.qodo.ch, tenant `AQ-VD-DEMO-PUBLIC`, comptes `admin@admin.ch` / `demo@demo.ch`, ~10 parcelles, ~435 animaux, plusieurs travaux + interventions + présences) impose de partir de l'existant :

| PRD v0.1 (anglais, neuf)  | Réalité prod (FR, à conserver)                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ThirdPartyWork`          | `Travail` (M6) — `interne`, `partenaireId`, `parcelleId`, `projetId`, `odooSaleOrderId`, `odooTaskId`, `lignesProduit[]`, `lignesHeure[]`, `statut DRAFT/VALIDATED/INVOICED/CANCELLED`                                                                |
| `FieldLog`                | `Intervention` (M2) — `type InterventionType` (SEMIS, FUMURE\_\*, PHYTO, RECOLTE, TRAVAIL_DU_SOL…), `produitId`, `materielId`, `surfaceHa`, `geom`, `cultureId`, `techniqueEpandage`, `rendementParHa`, `validationStatus`, `linkedTravailId` (cas B) |
| `Timesheet`               | `Presence` (M11) — Play/Stop, `type PresenceType CHANTIER` (par défaut), `dureeMinutes`, `userId`                                                                                                                                                     |
| `WorkType`                | `MaterielCategorie` enum + `Materiel` table (TRAVAIL_DU_SOL, SEMIS, FUMURE, PHYTO, RECOLTE, MAINTENANCE, AUTRE)                                                                                                                                       |
| `Product` + `ProductKind` | `Produit` + `ProduitCategorie` (SEMENCE, ENGRAIS_MINERAL, ENGRAIS_ORGANIQUE, PHYTO, AUTRE) — catalogue OFAG en cours                                                                                                                                  |
| `Partner`                 | `Exploitation` + `PartnerLink` (M16) — un partenaire = une autre exploitation Agri Qodo                                                                                                                                                               |
| `Project`                 | `Projet` (PR #115-117) — settings tenant `noterTempsParProjet`, `defaultProjetTravauxTiersId`                                                                                                                                                         |

**Conséquence** : on **ne crée pas** d'enum `WorkCategory`, `ProductKind`, `InterventionType` (le dernier existe déjà avec une sémantique différente). On réutilise.

---

## 3. Concept v0.2 — la porte unique sans casse

### 3.1 UX cible

Un seul FAB **+ Nouvelle intervention** depuis :

- `/activites` (page d'accueil métier)
- `/parcelles/[id]` (contextualise `parcelleId`)
- `/travaux` (compatibilité ancien menu, à terme renommé "Activités")

→ ouvre **`/interventions/new`** (route déjà existante, à étendre) avec **3 onglets** :

| Onglet                                                                              | Modèle backend cible           | Cas d'usage                                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 🌱 **Carnet des champs** (par défaut si parcelle perso)                             | `Intervention` (M2)            | Semis, fumure, phyto, récolte sur ma parcelle. Crée `project.task` Odoo si configuré (best-effort, déjà en place). |
| 🤝 **Travaux pour tiers**                                                           | `Travail` (M6) `interne=false` | Prestation facturable chez un partenaire. Crée `sale.order` Odoo brouillon (auto-push livré PR #119).              |
| 🛠️ **Travail interne** _(nouveau libellé pour le cas existant)_                     | `Travail` (M6) `interne=true`  | Activité de mon exploitation à tracer (sans facturation). Crée `project.task` Odoo (PR #112).                      |
| ⏱️ **Pointage horaire** _(intégré dans chacun des 3 onglets, plus un bouton dédié)_ | `Presence` (M11)               | Saisie heures sans intervention agronomique ni travail tiers.                                                      |

→ **Pas de 4ème entité**. L'onglet est un **switch d'UI** qui décide quel `mutation` appeler (`useCreateIntervention` / `useCreateTravail` / `useClockIn`).

### 3.2 Champs communs aux 3 onglets

Pour donner une sensation d'unité :

- **Date** (`dateOperation` ou `date`)
- **Parcelle** (optionnelle — facultative pour Travail tiers et Pointage)
- **Notes**
- **Heures** — affichées par défaut sur les 3 onglets (Carnet, Travail tiers, Travail interne).
- **3 toggles paramètre granulaires** (Exploitation, défaut `true` chacun, **décision Fabien 2026-05-04 soir**) :
  - `heuresVisiblesCarnet`
  - `heuresVisiblesTravauxTiers`
  - `heuresVisiblesTravauxInterne`
    Permet à chaque exploitation de choisir où elle saisit des heures (ex : facturation client uniquement → ne cocher que `heuresVisiblesTravauxTiers`).
- **HHMM compact qodo-clock** (`HhmmTimeInput` déjà dispo).
- **Multi-employés** : **retiré** de la fusion (décision Fabien 2026-05-04 soir). Pas de table `InterventionParticipant`. La saisie reste mono-utilisateur (l'auteur). Si besoin futur de multi-employés, c'est un sprint dédié.

### 3.3 Champs spécifiques

- **Carnet** : type intervention, produit, matériel, surface, rendement (si récolte), géom (sous-zone), technique épandage (si fumure organique). + heures (si `heuresVisiblesCarnet=true`) → champs heures simples sur l'intervention (mono-utilisateur).
- **Travaux tiers** : client (Exploitation partenaire), projet (selon settings), lignes produits, taux horaire. + heures (si `heuresVisiblesTravauxTiers=true`) → `LigneTravailHeure` (existant).
- **Travail interne** : projet (selon settings), lignes produits, **pas** de client. + heures (si `heuresVisiblesTravauxInterne=true`) → `LigneTravailHeure`.
- **Pointage simple** : `Presence` Play/Stop existant, accessible depuis le FAB et `/presences` indépendamment des 3 toggles.

---

## 4. Décisions sur les 7 questions ouvertes (PRD v0.1 §15)

| #   | Question                                     | Décision                                                                                                                                                                                                                                       | Action                                    |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Destination heures travaux tiers             | **Compta analytique par client (option C)** : 1 projet Odoo `Agri Qodo - Travaux tiers`, 1 tâche par client, ligne d'heures pointée dessus. Heures **jamais sur le sale.order client** (juste produits + main d'œuvre forfaitaire si activée). | Sprint 1 — étendre `odoo-push.service.ts` |
| 2   | Tag analytique multi-niveaux                 | **V1 = projet+tâche par client uniquement**. Multi-niveau (parcelle+culture) en V2.                                                                                                                                                            | Backlog                                   |
| 3   | Édition d'une intervention déjà synchro Odoo | **Bloquer l'édition si `Travail.statut = INVOICED`**, autoriser sinon avec re-push automatique. Afficher bandeau jaune "déjà poussé" si DRAFT/VALIDATED.                                                                                       | Sprint 2                                  |
| 4   | Champ `customFields jsonb`                   | **Ajouté maintenant** sur `Intervention` et `Travail` (`Json?`). UI plus tard. Coût marginal, prévient une migration future.                                                                                                                   | Sprint 0                                  |
| 5   | Multi-employés sur Carnet                    | **Oui dès V1**. Réutilise `LigneTravailHeure` pour Travail (déjà 1..N), ajoute table `InterventionParticipant (interventionId, userId, dureeMinutes?)` pour Carnet.                                                                            | Sprint 1                                  |
| 6   | Notification rendements en attente           | **Email + bandeau in-app**. Pas de push V1.                                                                                                                                                                                                    | Sprint 3                                  |
| 7   | Import catalogue OFAG ~3000 produits         | **Avant Sprint 1** — script seed `prisma/seed-ofag.ts` séparé. Sinon création à la volée bloque.                                                                                                                                               | **Pré-requis Sprint 1**                   |

**Question supplémentaire tranchée** :

- **Migration des données démo** : non destructive, mapping écrit en Sprint 0 (cf §5).

---

## 5. Sprint 0 — Migration non destructive _(nouveau, pas dans v0.1)_

**Durée estimée** : 3-5 jours.
**But** : préparer le terrain sans casser la prod.

### 5.1 Schéma Prisma — additions seules (pas de drop)

```prisma
// PR #99 EditHistory déjà en place — étendre les entityType
// PR #115 Projet déjà en place — réutilisé tel quel

model Intervention {
  // ...existant...
  customFields Json? @map("custom_fields") // §4 q4
  participants InterventionParticipant[]   // §4 q5
}

model InterventionParticipant {
  id             String       @id @default(uuid())
  interventionId String       @map("intervention_id")
  userId         String       @map("user_id")
  dureeMinutes   Int?         @map("duree_minutes")
  notes          String?
  createdAt      DateTime     @default(now()) @map("created_at")

  intervention Intervention @relation(fields: [interventionId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([interventionId, userId])
  @@index([userId])
  @@map("intervention_participants")
}

model Travail {
  // ...existant...
  customFields Json? @map("custom_fields") // §4 q4
}

model Exploitation {
  // ...existant (noterTempsParProjet, defaultProjetTravauxTiersId)...
  // 3 toggles granulaires d'affichage des heures (décision 2026-05-04 soir).
  heuresVisiblesCarnet         Boolean @default(true) @map("heures_visibles_carnet")
  heuresVisiblesTravauxTiers   Boolean @default(true) @map("heures_visibles_travaux_tiers")
  heuresVisiblesTravauxInterne Boolean @default(true) @map("heures_visibles_travaux_interne")
}

// Note : pas de table InterventionParticipant — multi-employés retiré
// du Sprint 0 (décision 2026-05-04 soir).
// Aucun drop, aucun rename, aucune contrainte modifiée.
```

### 5.2 Données — vérification non-régression

- ✅ `Travail` existants : conservés tels quels (DRAFT/VALIDATED/INVOICED).
- ✅ `Intervention` existantes : conservées (validationStatus, geom, etc.).
- ✅ `Presence` existantes : conservées (Play/Stop fonctionne toujours).
- ✅ `Projet` (PR #115) + settings tenant : conservés.
- ✅ Push Odoo auto (PR #119) : conservé, étendu pour les 2 nouvelles tables (intervention_participants).

### 5.3 Tests à écrire avant Sprint 1

- E2E : créer un Carnet sur parcelle perso → `Intervention` + `project.task` Odoo.
- E2E : créer un Travail tiers → `Travail interne=false` + `sale.order` Odoo brouillon.
- E2E : créer un Travail interne → `Travail interne=true` + `project.task` Odoo.
- E2E : démarrer un pointage → `Presence` ouverte.
- Migration test : restaurer un dump prod du 2026-05-04, lancer `prisma migrate deploy`, vérifier que toutes les pages chargent + données présentes.

---

## 6. Sprints 1-4 (révisés)

### Sprint 1 — Écran unifié `/interventions/new` à 3 onglets _(~5 j)_

- Page `/interventions/new` étendue avec onglets (`<Tabs>` shadcn).
- Routing intelligent : si parcelle perso pré-sélectionnée → onglet Carnet par défaut.
- 3 onglets appellent les 3 mutations existantes (`useCreateIntervention`, `useCreateTravail`, `useClockIn`).
- FAB **+ Nouvelle intervention** depuis `/activites`, `/parcelles/[id]`, `/travaux`.
- Multi-employés sur Carnet (utilise `InterventionParticipant`).
- Création à la volée Produit / Matériel / Client (déjà partiellement dispo).

### Sprint 2 — Vue planning + édition synchro Odoo _(~5 j)_

- Mode **planning** sur `/activites` (datePrevue + statut À FAIRE/FAIT) — ajout colonne `datePrevue` + `statut PLANIFIE/FAIT/ANNULE` sur `Travail` et `Intervention`.
- Édition d'un travail pas encore facturé → re-push Odoo auto (réutilise PR #119).
- Bandeau "déjà poussé sur Odoo" sur `/travaux/[id]` et `/interventions/[id]`.
- Bloquer édition si `INVOICED`.

### Sprint 3 — Compta analytique heures + facturation groupée _(~5 j)_

- `odoo-push.service.ts` : créer/réutiliser projet `Agri Qodo - Travaux tiers` + 1 tâche par client.
- Pointer les heures de Travaux tiers sur la tâche (option C).
- Facturation groupée : 1 sale.order brouillon mensuel par `[partenaireId, YYYY-MM]` au lieu d'un par travail (config tenant).
- Notification email + bandeau in-app pour rendements en attente (>3 j après récolte).

### Sprint 4 — Permissions individuelles + polish _(~5 j)_

- Permissions individuelles par employé (RBAC granulaire — D1 backlog).
- Calendrier mensuel responsive mobile (B1 backlog).
- Recherche + ResourceView sur `/presences` (B2 backlog).
- Polish UI, tests régression.

**Total révisé** : 4 sprints (Sprint 0 + 4 sprints fonctionnels) ≈ 4 semaines de dev.

---

## 7. Hors-périmètre

- Pas de renommage de tables (vocabulaire FR conservé).
- Pas de fusion en une seule entité `Intervention` au sens v0.1 — la fusion est **UI-only**, le backend garde 3 modèles spécialisés.
- Catalogue OFAG : seed séparé (avant Sprint 1), pas dans la fusion.
- Mobile React Native : pas dans les 4 sprints, suivra une fois la web stable.

---

## 8. Risques résiduels

| Risque                                                                                 | Mitigation                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration Prisma `add column custom_fields` long sur table `interventions` volumineuse | À ce jour <1000 lignes (démo + tests) → quasi instantané. Surveiller à terme.                                                                                |
| Régression push Odoo auto (PR #119)                                                    | Tests E2E Sprint 0 avant tout merge.                                                                                                                         |
| UX 3 onglets perçue comme complexe                                                     | A/B mental : si Fabien trouve confus en Sprint 1, on simplifie en 2 onglets (Activité parcelle vs Activité tiers, le pointage devient un sous-mode).         |
| Confusion Travail interne vs Carnet                                                    | Distinction claire dans l'UI : Carnet = action agronomique sur parcelle (semis, etc.), Interne = activité sans tracé agro (entretien matériel, admin, etc.). |

---

## 9. Critères d'acceptance (DoD du PRD)

- ✅ Toutes les données démo prod restent intactes après migration.
- ✅ FAB `+ Nouvelle intervention` accessible depuis 3 endroits.
- ✅ 3 onglets fonctionnels créent les 3 entités existantes sans rupture.
- ✅ Push Odoo auto fonctionne pour les 3 cas (project.task pour Carnet+Interne, sale.order pour Tiers).
- ✅ Multi-employés sur Carnet.
- ✅ Édition possible tant que pas `INVOICED`.
- ✅ Mode planning avec datePrevue + statut.
- ✅ Tests E2E couvrant les 3 flows.

---

## 10. Prochaine action

1. ✅ Validation Fabien sur PRD v0.2 (ce document).
2. → Création branche `feat/fusion-interventions`.
3. → Sprint 0 : ajout `customFields` + `InterventionParticipant`, tests régression sur dump prod.

---

_Fin PRD v0.2. Une fois validé, créer la branche `feat/fusion-interventions` et démarrer Sprint 0._
