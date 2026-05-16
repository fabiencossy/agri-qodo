# CLAUDE.md — NewagriQodo v2

Brief de passation pour **Claude Cowork**. Pour le détail technique exhaustif, voir `docs/4_Phases/HANDOFF.md`.

## Projet

Refonte UX du module **Agri Qodo** de **Qodo Digital** (Fabien Cossy, fondateur).
- Apps pour exploitations agricoles suisses (Suisse romande, Échallens — Domaine Darval).
- Distinct de la prod actuelle `newagri.qodo.ch` (VPS Infomaniak `83.228.247.77`).
- Vit dans `app/` (Vite + React 19 + TS 6 strict + Tailwind v4 + Leaflet + React Router v7).
- Conventions strictes : light only, radius via variables CSS, pas d'emoji, pas de dark mode, icônes SVG inline style Lucide.

## Structure du repo

```
NewagriQodo/
├── .claude/             ← settings.json (hooks) + agents/ (component-validator, ux-reviewer, agronome-validator)
├── app/                 ← Source React/TS (Vite + Tailwind v4 + Leaflet)
├── docs/                ← Doc versionnée structurée (1_Overview → 8_Wireframes)
├── Phase0_Components/   ← Spec composants Phase 0
├── assets/              ← Logos
├── CLAUDE.md            ← Vous êtes ici
└── README.md            ← Entry point projet
```

## Où on en est (2026-05-16, fin session 3)

| Phase | État |
|---|---|
| **Phase 0** — 9 wireframes HTML validés par le PO | ✅ |
| **Phase 1** — 9 composants React + 55 tests Vitest (tous passent) | ✅ |
| **Phase 2** — App routée + module pilote **Parcellaire** + module **RH** | ✅ |
| **Phase 2.5** — Plan d'assolement, données réelles Darval, multi-sélection, import GeoJSON | ✅ MVP |
| **Session 3 (2026-05-16)** — Nettoyage docs, hooks Claude Code, agents, store partagé | ✅ |
| **Session 3 (suite)** — Module Carnet des champs (interventions, fumure réelle base) | ✅ |
| **Session 3 (suite)** — Module Fumure OEngrais (palier 2), onglets parcelle, stats, paramètres CRUD | ✅ |
| **Session 4 (2026-05-16)** — Paramètres en layout 2 colonnes, droits utilisateurs, modules Troupeau + Travaux MVP, Suisse-Bilanz, mapping Odoo FSM via étiquettes | ✅ |
| **Phase 3** — Sync Odoo XML-RPC (push tasks FSM / sale.order / timesheets), dialog editing parcelle existante | À venir |

## Modules implémentés

### Parcellaire (`/parcellaire`) — 4 vues (Fusion v2)
- **27 parcelles réelles** du Domaine Darval (chargées depuis `app/src/modules/parcellaire/darval.geojson.json` — export VD GELAN 2026)
- Mapping affectation Agridéa → culture du catalogue (Blé d'automne, Maïs ensilage, Prairie temporaire, Prairie naturelle, Pâturage, Prairie extensive, Forêt, Surface improductive)
- **4 vues** : Carte (Leaflet satellite Swisstopo) / Table / **Timeline (Gantt 12 mois × parcelles, sélecteur Campagne)** / Dashboard
- Vue Timeline : édition inline des segments (clic segment ouvre `AssolementSegmentModal`, bouton + par ligne pour ajouter)
- SearchBar avec filtre par groupes de cultures (Blé, Orge, Maïs, Colza, Betterave, Prairie, Jachère)
- **Table avec multi-sélection** : checkbox + barre d'actions groupées (Fusionner, Dupliquer, Archiver, Exporter, Supprimer). Sur mobile : un seul bouton "Actions ⌄".
- **Panneau riche** au clic sur parcelle (carte) : Plan d'assolement (timeline 12 mois + culture du jour), Stade phéno (mock BBCH), Bilan de fumure N/P/K (mock), Dernières interventions (mock), Notes. Footer "Ouvrir la fiche complète".
- **Outils carte** (desktop uniquement) : Sélection, Dessiner une parcelle, Pin, Mesurer. Lasso supprimé. Group/layers retirés des defaults.
- **Dialog post-dessin** : après double-clic qui ferme un polygon, ouverture d'un modal pour saisir Nom / Code / Culture initiale / Notes. Surface calculée auto.
- **Kebab ⋮** : Importer GeoJSON / Importer Shapefile (.zip via shpjs) + Export PDF/Excel/CSV.

### Plan d'assolement (`/assolement`)
- Modèle : **segments temporels** (1 segment = 1 culture sur une période continue), N segments par parcelle/campagne.
- Catalogue Agridéa : **42 cultures** en 9 catégories, couleurs vives flashy pour contraste satellite.
- **Découpe automatique** : si on save un segment qui chevauche un existant → l'existant est coupé en deux ou tronqué (règle "pas deux cultures simultanées").
- **Fusion automatique** : segments adjacents même culture → fusionnés en un seul.
- 3 vues : Carte (parcelles peintes par culture dominante) / Timeline (Gantt 12 mois × parcelles) / Table.
- Sélecteur Campagne (2024 / 2025 / 2026).
- Panneau de détail (aside desktop / bottom-sheet mobile) : timeline détaillée, liste des segments éditables, formulaire d'édition (culture, variété, dates, notes).
- Table avec multi-sélection (Fusionner en un assolement commun, Appliquer un segment, Dupliquer le plan vers une autre campagne, Exporter).
- FAB : "Ajouter un segment" quand parcelle sélectionnée.
- Navigation contextuelle : `?parcel=PF-001` ouvre directement le panneau pour cette parcelle.

### Page détail parcelle (`/parcellaire/:id`) — onglets
- Header : Back + Titre + Status badge + icône fine Itinéraire + Kebab (Dupliquer / Archiver / Supprimer)
- FAB **unifié** standard (cf. `useStandardFabActions` plus bas), highlight `intervention`
- **6 onglets** :
  - **Aperçu** : Identification + Statut + mini-carte + 3 cards résumé cliquables (Assolement / Carnet / Fumure) + Notes
  - **Carnet** : InterventionList des interventions de cette parcelle (8 dernières + lien carnet complet)
  - **Assolement** : timeline cliquable + gros bouton "Ajouter un segment" sous la timeline + liste des segments éditables (modal `AssolementSegmentModal` réutilisable)
  - **Fumure** : `FumurePanel` (OEngrais 2024, cards N/P/K cliquables → drawer détail)
  - **Statistiques** : rendement par campagne, apports cumulés, compteurs interventions
  - **Localisation** : carte large + Itinéraire Google Maps

### Module Fumure (`fumure/`) — Palier 2 OEngrais 2024
- Besoins par culture (15 cultures référencées) — `cultureNeeds(culture)`
- Précédent cultural (résidus N selon culture précédente) — `previousCropResidualN()`
- Coefficients d'efficacité organique (lisier/fumier/compost × saison) — `organicEfficiencyCoef()`
- `computeFumureBalance()` : bilan complet avec apports disponibles 1re année (vs bruts)
- Cards **N / P / K cliquables** → drawer détail (`FumureDrawer`) : besoin/apports/solde, historique chronologique des apports, fenêtres BBCH conseillées, bouton "Ajouter un apport" → ouvre InterventionForm en mode fertilisation
- Reste à apporter **décomposé par élément** (plus de total flou)

### Page Paramètres (`/parametres`) — layout 2 colonnes style Odoo (session 4)
- **Sidebar gauche** : 3 groupes (Général / Données de référence / Intégrations) avec 9 sections — `parametres.sections.tsx` source de vérité
- **Routes nestées** : `/parametres/{exploitation,utilisateurs,utilisateurs/:id,preferences,cultures,produits,cheptel,travaux,odoo,meteo}`
- **Exploitation** : édition farm (nom, localité, n° cantonal, surface, notes)
- **Utilisateurs** : liste + recherche + filtre archivés + détail (`UtilisateurDetailPage` style Odoo : Informations / Accès par module / Synchronisation Odoo avec étiquettes Field Service)
- **Préférences** : langue, format date, devise, unités, notifications (stocké localStorage via `preferences.store`)
- **Cultures** : catalogue Agridéa lecture seule, recherche + filtre catégorie
- **Catalogue produits** : phyto/engrais/semences, CRUD via `ProductEditModal`
- **Cheptel** : référentiel 21 catégories animales (DBF Agroscope 2017) + récap effectifs Darval
- **Travaux pour tiers** : catalogue 21 prestations (tarifs Agridéa 2024) + CRUD clients
- **Intégration Odoo** : XML-RPC settings + mapping 6 entités + audit Mapping employés ↔ étiquettes FSM
- **MétéoSuisse** : settings station + auto-fill météo intervention (Phase 3)

### Carnet des champs (`/carnet`)
- Modèle : **interventions datées** par parcelle, 9 catégories (semis, fertilisation, phyto, travail du sol, travaux culturaux, récolte, observation, irrigation, autre).
- ~80 interventions mock générées depuis les segments d'assolement Darval (semis blé/maïs, apports N, traitements, fauches prairies, récoltes).
- Champs riches : produit, dose+unité, N/P/K kg/ha, type phyto + délai d'attente, stade BBCH, rendement, opérateur, météo, notes.
- 2 vues : Table (multi-select, bulk actions) / Timeline (groupée par mois).
- SearchBar avec filtres par catégorie / produit / opérateur.
- FAB : Nouvelle intervention.
- Sélecteur Année.
- ExportButton (PDF/Excel/CSV).
- Section "Carnet des champs" intégrée dans `ParcelleDetailPage` : 8 dernières interventions + bouton "Voir le carnet complet" (→ `/carnet?parcel=ID`).
- FAB ParcelleDetailPage → ouvre `InterventionForm` (avec parcelle verrouillée), pas plus d'`alert()`.

### Troupeau (`/troupeau`) — session 4
- Modèle simple : **effectifs annuels moyens par catégorie**, pas d'animaux individuels (Phase 3 = import BDTA).
- Catalogue **21 catégories** (`livestock.catalog.ts`) selon DBF Agroscope 2017 / OEngrais 2024 : bovins laitiers (3 niveaux production), allaitants, jeunes, ovins, caprins, porcins, équins, volailles.
- Pour chaque catégorie : UGB/tête, excrétion N/P₂O₅/K₂O kg/an, volume effluents m³ ou t/an, type effluent (lisier/fumier-frais/composté/fientes).
- 2 vues : Table (groupée par espèce, cliquable entière) / Dashboard (KPIs + production effluents par type).
- Effectifs Darval mocks : 42 vaches laitières, 28 génisses, 12 jeunes, 80 poules.
- Alerte UGB/ha si > 3.0 (limite OPD art. 47 zone plaine).
- Squelette standard : SearchBar (espèce, type d'effluent) + ViewSwitcher + ExportButton + useFabActions.

### Travaux pour tiers (`/travaux`) — session 4, aligné Odoo Field Service
- **Modèle multi-lignes + multi-saisies temps** (1 bon ≠ 1 prestation) :
  - `WorkOrder` = header (date, client, machine, parcelles multi, statut, **priority** 0-3, **userIds**, **tagIds**, fsmDone) ↔ `project.task` (is_fsm=True)
  - `WorkOrderLine[]` (1..N) = prestations avec type/durée/surface/tarif/total ↔ `sale.order.line` (chacune avec son `product.product`)
  - `WorkTimeEntry[]` (0..N) = saisies temps avec opérateur/date/start/end/durée, optionnellement liées à une ligne ↔ `account.analytic.line`
- **La task FSM n'a pas de product** : les products (services) sont uniquement sur les sale.order.line — c'est la sémantique Odoo native.
- **Assignation par étiquettes** : `WorkOrder.userIds` mappé vers `task.tag_ids` (pas `task.user_ids`) via `AppUser.odooTagId`. Convention du projet (employés sans licence Odoo). Helper `users/odoo-mapping.ts`.
- 3 vues : Table (cliquable entière) / Timeline (groupé par mois, cliquable) / Dashboard (par catégorie, par client, par statut).
- Catalogue 21 prestations (tarifs Agridéa Coûts-machines 2024) avec auto-fill tarif depuis type.
- `ParcelMultiPicker` réutilisé (avec `allowEmpty`) pour sélection multi-parcelles dans le modal.
- 4 clients Darval mock + 5 bons multi-lignes.

### Plan de fumure exploitation (`/fumure`) — Suisse-Bilanz v1.16 simplifié (session 4)
- Méthode OEngrais 2024 — couvre modules 1 (besoins) et 2 (apports), module 3 (transferts DIGIFLUX) en saisie libre.
- 2 vues : Dashboard (KPIs N/P, décomposition apports, alertes non-conformité) / Table (besoins par parcelle exportable).
- Inputs : SAU active × culture (via segments d'assolement) × normes besoins. Effluents troupeau × coef efficacité 1re année. Apport atmosphérique 17 kg N/ha (OFEV 2018). Résidus culturaux saisie libre. Imports/exports DIGIFLUX avec type d'effluent configurable.
- Conformité Suisse-Bilanz : ±10% (couverture 90-110%). Warnings auto si dépassement ou si UGB/ha > 3.0.
- Auto-fill apports minéraux depuis carnet (interventions catégorie='fertilization' produit type='fertilizer' catégorie='mineral').
- Squelette standard : SearchBar (culture, conformité) + ViewSwitcher + ExportButton + useFabActions.

### Modules secondaires
- RH (`/rh/heures`, `/rh/saisir`, `/rh/conges`) — Phase 2, inchangé

## Système de droits par utilisateur (session 4, style Odoo)

- **`AppUser.permissions?: Record<ModuleKey, PermissionLevel>`** (optionnel — override les défauts du rôle).
- 8 modules : `parcellaire / assolement / carnet / fumure / troupeau / travaux / rh / parametres`.
- 4 niveaux : `none / read / write / admin` (cumulatifs, comparables via `meetsLevel`).
- 3 rôles défauts (`ROLE_DEFAULTS`) : Admin (all admin), Editor (write métier + read RH/paramètres), Viewer (read partout, none paramètres).
- Helper principal `canAccess(user, module, level)` + hook React `useCan(module, level)`.
- `useCurrentUser()` — placeholder MVP (1er admin actif), Phase 3 ↔ `auth.users.id` ↔ `farm_workers.user_id`.
- UI : `UtilisateurDetailPage` avec tableau matrice radio "défaut du rôle vs override fin par module".

### Mapping Odoo Field Service (session 4)

Convention : les employés AgriQodo sont représentés en Odoo par des **étiquettes `project.tags`** (pas par `res.users`), car la plupart n'ont pas de licence Odoo.

- `AppUser.odooTagId?: number` — référence à l'étiquette `project.tags` dédiée à cet employé
- `AppUser.odooEmployeeId?: number` — `hr.employee.id` pour les timesheets
- `AppUser.odooUserId?: number` — `res.users.id` (optionnel, uniquement employés avec licence)
- Helpers `users/odoo-mapping.ts` : `userIdsToOdooTagIds()` / `userIdsToOdooUserIds()` / `userIdToOdooEmployeeId()` / `listUsersMissingOdooTag()`
- UI : audit "Mapping employés ↔ étiquettes" dans `/parametres/odoo` listant les employés actifs sans tag avec lien direct vers leur fiche.
- Mapping côté `WorkOrder` :
  - `WorkOrder.userIds` (AppUser.id[]) → `task.tag_ids` au sync
  - `WorkOrderLine.workType` → `product.product` (type 'service') sur `sale.order.line`
  - `WorkTimeEntry.operatorId` → `hr.employee.id` (via `AppUser.odooEmployeeId`) sur `account.analytic.line.employee_id`
  - Mapping statut : `WO_STATUS_TO_STAGE` Record exporté

## Composants Phase 1 partagés

`SearchBar`, `ViewSwitcher`, `ExportButton`, `FieldPicker`, `AsideCard`, `HoursTableMonth`, `LeaveRequestList`, `TimesheetEntry`, `MapView` (Leaflet + outils + drawn layers).

**Ajoutés en Phase 2.5** :
- `DetailPanel` (aside/bottom-sheet générique, accepte children custom + footer)
- `BulkActionsBar` + `TableCheckbox` (multi-sélection tables, desktop inline / mobile menu compact)
- `AssolementTimeline` (frise 12 mois variantes row/detail — nom culture sur slot)
- `AssolementDetailPanel`, `AssolementSegmentEditor` (édition segments)
- `AssolementSegmentModal` (modal réutilisable d'édition de segment)
- `ParcelleSummaryPanel` (panneau riche carte Parcellaire avec édition assolement inline)

**Ajoutés en Session 3** :
- `Tabs` + `TabPanel` (composant réutilisable, onglets scrollables mobile)
- `EntityLink` + `ParcelLink` (liens internes standardisés, 3 variantes : chip / compact-button / tap-row, icône ↗)
- `InterventionTypeIcon` (icônes Lucide par catégorie carnet, avec ou sans bg)
- `InterventionList` (table + cards mobile structure fixe 4 lignes, multi-select)
- `InterventionForm` (modal — sélecteur visuel catégorie, ProductSelect auto-fill, n° OFAG, date récolte autorisée, UserSelect, aide BBCH, durée travail)
- `ProductSelect` (filtré par type + culture autorisée pour phyto)
- `UserSelect` + `UserChip` (avatar coloré + nom)
- `UserEditModal`, `ProductEditModal` (CRUD Paramètres)
- `FumurePanel` + `FumureDrawer` (Palier 2 OEngrais)
- `ParcelleStats` (rendement, apports cumulés, compteurs)
- `Fab` repensé : action highlight = `variant: 'primary'` (fond vert pâle + icône vert plein), action highlight remontée juste après "Créer une intervention" qui reste toujours #1
- `InterventionFormProvider` global → ouvre le form depuis n'importe quelle page sans navigation
- `useStandardFabActions(opts)` hook : set d'actions FAB standards (5 actions toujours présentes, highlight contextuel)
- `fab-icons.tsx` : 9 icônes Lucide-style (Pencil intervention, BookOpen carnet, Hexagon parcelle, etc.)

**Mobile cards** sur les 3 tables (Intervention, Parcellaire, Assolement) : desktop = table, mobile = cards verticales avec structure fixe 4 lignes (titre+date / catégorie+parcelle / dose+opérateur / notes).

## Comment reprendre

```bash
cd ~/Projects/NewagriQodo/app
npm install
npm run dev         # http://localhost:5173 (ou 5174 si 5173 occupé)
npm test            # 55 tests Vitest
npm run typecheck   # tsc strict
npm run lint        # ESLint (0 warning attendu)
```

**Pre-commit Husky** : `lint-staged` lance `eslint --fix` + `prettier` automatiquement.

**État git** : pas tout commité (voir `git status`). Session 3 = grosse réorg docs + nouveaux fichiers `.claude/`.

## Hooks Claude Code en place

`.claude/settings.json` (à fusionner depuis `.claude/settings.security.json`) branche les scripts dans `.claude/scripts/`. Le `$` prefix dans les noms ci-dessous = bloquant (exit 2).

### Bloquants (PreToolUse)
- `$ block-dangerous-bash.sh` (Bash) — rm -rf, push --force, reset --hard, etc.
- `$ protect-darval.sh` (Edit/Write) — bloque modif `darval.geojson.json`
- `$ block-secrets-in-edit.sh` (Edit/Write) — JWT, clés API (Resend/Stripe/OpenAI/AWS/GH), private keys, passwords
- `$ block-env-files.sh` (Edit/Write) — interdit `.env*` réels (autorise `.env.example`)
- `$ block-service-key-front.sh` (Edit/Write) — interdit `SERVICE_KEY` / `service_role` / `supabase.auth.admin` dans `app/src/`

### Informatifs (PostToolUse — warning sans bloquer)
- `post-edit-check.sh` — typecheck + lint sur fichiers app/src/
- `check-no-emoji-global.sh` — interdit emoji partout dans app/src/
- `check-component-conventions.sh` — radius CSS vars, dark, Lucide, test associé
- `check-page-consistency.sh` — *Page.tsx doit avoir SearchBar + ViewSwitcher + FAB + Export
- `validate-cultures.sh` — couleurs hex uniques + champs complets
- `check-rls-coverage.sh` — table créée dans migration → policy RLS associée
- `check-xss-risks.sh` — dangerouslySetInnerHTML, eval, .innerHTML =, redirections dynamiques
- `check-debug-leaks.sh` — console.log avec password/token/session
- `check-cors-wildcard.sh` — CORS `*` dans Caddyfile/docker-compose/kong, ports DB exposés
- `check-deps-audit.sh` — CVE high+ après modif `package.json`

### Autres
- **Stop** : `run-changed-tests.sh` (vitest related sur fichiers modifiés)
- **SessionStart** : `session-start-recap.sh` (git status + last commit)

## Agents Claude Code en place (session 3)

`.claude/agents/` :

- **component-validator** — Audite un nouveau composant React (conventions visuelles, TS, tests, a11y).
- **ux-reviewer** — Audite une *Page.tsx (squelette, multi-select tables, z-index, responsive).
- **agronome-validator** — Vérifie cohérence agricole (cultures Agridéa, dates semis, normes OEngrais).
- **security-auditor** — Audit OWASP/RLS/secrets/CORS complet. Avant chaque deploy prod ou après modif auth/RLS.
- **rls-reviewer** — Review d'une migration SQL touchant les Row-Level Security policies.
- **secrets-scanner** — Scan working tree + git history pour JWT / clés API / private keys / passwords fuités.

Invocation : `Task` tool avec `subagent_type: "component-validator"` etc.

## Sécurité — règles non-négociables

Détail complet : `SECURITY.md`. Les hooks `block-*.sh` (PreToolUse) bloquent les violations en temps réel.

- **Jamais `service_role` côté front** — uniquement `ANON_KEY`. Hook `block-service-key-front.sh` exit 2.
- **Jamais éditer `.env`** — uniquement `.env.example`. Secrets générés par `bootstrap.sh`. Hook `block-env-files.sh` exit 2.
- **Jamais de secret en dur** (JWT, clé API, password, private key). Hook `block-secrets-in-edit.sh` exit 2.
- **RLS activée partout** — toute nouvelle table farm-scope = `enable row level security` + policies `is_farm_member()` / `is_farm_admin()`. Hook `check-rls-coverage.sh` warn si oublié.
- **Mode démo étanche** — n'appelle JAMAIS Supabase. Pattern dual-mode (`getAuth().mode !== 'authenticated' || !supabase`) obligatoire dans tous les stores. `enterDemoMode()` purge la session Supabase.
- **Inscription publique désactivée par défaut** (`DISABLE_SIGNUP=true` serveur + `VITE_DISABLE_SIGNUP=true` front). Comptes via invitation (RPC `accept_farm_invitation`).
- **Ports DB jamais publics** — Postgres + Kong bindés `127.0.0.1` uniquement.
- **CORS restreints** — uniquement `newagri.qodo.ch` + `localhost:5173`. Jamais `*`. Configuré aux 2 niveaux (Caddy + Kong).
- **Pas de `console.log(user/session)`** — contiennent le JWT. Hook `check-debug-leaks.sh` warn.
- **Avant chaque deploy prod** : `Task` `security-auditor` sur le diff.

## Prochaines priorités (en attente)

### Quick wins UX
- **Fusion v2 Timeline Parcellaire** : intégrer la vue Timeline Gantt assolement dans ParcellairePage (4 vues : Carte / Table / Timeline / Dashboard) + sélecteur Campagne conditionnel
- **ProductPicker modal** : remplacer le `<select>` natif par un modal plein écran avec recherche (vu qu'il y aura beaucoup de produits)
- **Calcul auto total dose** : sous le champ Dose, afficher le total absolu (ex. `180 grains/ha × 1.34 ha = 241 200 grains`)
- **Multi-sélection parcelles** dans InterventionForm + notion de "groupe de parcelles" persistant
- **FarmSwitcher** dropdown : changer d'exploitation (multi-tenancy MVP)
- **Carte plein écran** : onglet Localisation avec carte qui prend toute la hauteur disponible
- **Indicateur délai d'attente phyto** : `isUnderWithholding()` → badge rouge dans `ParcelleSummaryPanel` et `ParcelleDetailPage`

### Phase 3 — Intégration Odoo
- XML-RPC, `hr.attendance` (helper déjà en place), `hr.employee`, `res.users`, `agri.parcel` custom, `agri.intervention` custom, `agri.assolement.segment` custom, `product.product` (sync catalogue)
- Suisse-Bilanz export PDF officiel (autorités cantonales)
- Stade phéno réel BBCH (degrés-jours)
- Sync MétéoSuisse (auto-fill météo intervention)
- Pin avec info dialog (label/type/parcelle liée)
- Outil "Modifier parcelle existante" (drag sommets sur parcelle déjà créée)
- Menu contextuel sur éléments dessinés

### Modules à venir
- **Carnet des champs avancé** : photos d'observation, géolocalisation point d'observation
- **Module Travaux** (sortir du stub) : tâches + assignation + sync Odoo + facturation tiers (M11)
- **Module Troupeau** (sortir du stub) : animaux + événements + SRPA/SST
- **PWA / offline** : Parcellaire et Troupeau doivent fonctionner offline
- **Code splitting MapView** : `React.lazy()` Leaflet (~150 kB gzip à gagner)

## Fait en session 3 (2026-05-16)

### Infra
- **Nettoyage doc** : 30+ fichiers .md éparpillés à la racine → structure `docs/{1_Overview, 2_Architecture, 3_Features, 4_Phases, 5_Setup, 6_Agents, 7_References, 8_Wireframes}/`. Aucune perte d'info, archives obsolètes dans `docs/7_References/ARCHIVES/`.
- **`.claudecode.json` archivé** (référençait `frontend/`/`backend/` inexistants) → remplacé par `.claude/settings.json` propre.
- **Hooks Claude Code** : 9 scripts dans `.claude/scripts/` branchés via `.claude/settings.json`.
- **Agents projet** : 3 agents dans `.claude/agents/` (component-validator, ux-reviewer, agronome-validator).

### Modules livrés
- **Carnet des champs** : types, store pub/sub, ~80 interventions Darval, CarnetPage 2 vues, InterventionList mobile cards structure fixe 4 lignes, intégration ParcelleDetailPage, 16 tests Vitest, francisation subTypes (silage→Ensilage, mowing→Fauche, plowing→Labour…).
- **Users** : 5 mocks Darval, UserSelect/UserChip, UserEditModal CRUD, store add/update/remove.
- **Products** : 25 produits suisses (10 phyto OFAG, 8 engrais, 7 semences), ProductSelect avec auto-fill (type phyto / N/P/K depuis titre engrais — `nPerUnit` = kg élément/unité de dose, ex. lisier 4.5 kg N/m³), ProductEditModal CRUD.
- **Fumure (Palier 2 OEngrais 2024)** : besoins par culture, précédent cultural (résidus N), coefficients d'efficacité organique selon saison, computeFumureBalance complet, FumurePanel + FumureDrawer (cards N/P/K cliquables → détail avec historique + fenêtres BBCH + bouton "Ajouter un apport").
- **Assolement.store partagé** : édition inline depuis ParcelleDetailPage et ParcelleSummaryPanel via AssolementSegmentModal réutilisable. Plus de redirection vers /assolement.
- **Onglets ParcelleDetailPage** : 6 onglets (Aperçu / Carnet / Assolement / Fumure / Statistiques / Localisation). Aperçu enrichi avec mini-carte + 3 résumés cliquables.
- **ParcelleStats** : rendement par campagne, apports N/P/K cumulés, compteurs interventions par catégorie.
- **Page Paramètres** : Tabs Utilisateurs + Catalogue produits (CRUD complet, sync Odoo Phase 3).

### Composants partagés & UX
- **`useStandardFabActions(opts)`** : set FAB unifié (5 actions toujours présentes), `highlight` contextuel par page, action highlight remontée juste après "Créer une intervention" (toujours #1). Variant 'primary' = fond pâle + icône plein. Plus de badge "RECOMMANDÉ".
- **InterventionFormProvider** global dans AppLayout → clic FAB "Créer une intervention" ouvre directement le modal (plus de navigation `/carnet`).
- **EntityLink + ParcelLink** : liens internes standardisés (3 variantes), icône ↗.
- **Tabs + TabPanel** : composant réutilisable, onglets scrollables mobile.
- **Mobile cards** sur les 3 tables : structure fixe 4 lignes constantes.
- **HoursTableMonth** : prop `bordered` (défaut true) pour retirer le cadre wrapper.
- **InterventionForm** : sélecteur visuel catégorie (grille icônes), ProductSelect auto-fill, n° OFAG, date récolte autorisée, UserSelect, aide-bulle BBCH, champ durée travail (heures décimales). Validation au submit : si champs requis manquants, message contextuel sous le bouton.

### MapView
- **Snap auto** au 1er sommet pendant dessin parcelle (halo blanc/violet quand ≥3 sommets, clic <18px ferme polygon → dialog `NewParcelDialog` s'ouvre).
- **Drag des sommets** pendant dessin : chaque sommet est un marker draggable (icône divIcon violette ronde), update temps réel de la preview line.
- Nom culture affiché sur slots Timeline assolement (variant row aussi).
- Footer parcelle z-[1000] (chevauchement Leaflet corrigé).

### Suite session 3 (2026-05-16) — Quick wins + fusion v2

- **Calcul auto total dose** : sous le champ Dose, affichage temps réel du total absolu (ex. `180 grains/ha × 1.34 ha = 241 200 grains`). Helper `computeDoseTotal`.
- **ProductPicker modal** : sélecteur produit plein écran (mobile) / grand modal (desktop) avec recherche libre, regroupement par catégorie, infos visibles (OFAG, composition, variété), filtre cultures autorisées pour phyto avec toggle "voir tous".
- **Multi-sélection parcelles** dans `InterventionForm` : bouton "+ Appliquer à d'autres parcelles" → `MultiParcelPicker` modal. Au submit, crée N interventions identiques (1 par parcelle, id unique).
- **Carte plein écran** : onglet Localisation prend toute la hauteur (`calc(100vh-220px)`). Bouton "Plein écran" → overlay `fixed inset-x-0 top-[104px] bottom-0 z-[900]` (sous le FAB mais au-dessus du contenu).
- **FarmSwitcher** : module `farms/` (types, mocks 3 exploitations, store), composant dropdown dans footer sidebar. Multi-tenancy MVP visuel, filtrage des données Phase 3.
- **Fusion v2 Parcellaire/Assolement** : 4e vue **Timeline** dans `ViewSwitcher` Parcellaire. Sélecteur Campagne conditionnel (visible uniquement view='timeline'). Édition inline des segments via `AssolementSegmentModal`. Route `/assolement` toujours fonctionnelle pour rétrocompat.

### Quick fixes
- Bloc Stade phéno mock supprimé.
- Statuts exports parcelle francisés (Actif/Jachère/Archivé).
- Filtre Blé sur la carte : correction du matching groupe (cultureGroup au lieu de comparaison brute).
- Fusion nav v1 : entrée "Plan d'assolement" retirée de la nav (1 seule entrée Parcellaire visible).
- Bouton "Ajouter un segment" pattern unifié (gros bouton sous timeline via `onAdd`, plus de petit bouton en haut en doublon).
- 9 icônes FAB refaites (Pencil intervention parlant, BookOpen carnet, Hexagon parcelle…).
- Unité dose auto-remplie depuis produit sélectionné (override systématique).
- Calcul N/P/K corrigé pour engrais organiques.
- **2026-05-16 (en cours)** : durée travail dans intervention, validation form pédagogique, MesHeures sans cadre, EntityLink/Tabs/onglets parcelle/stats, module Fumure Palier 2 complet, Paramètres CRUD.

## Points d'attention techniques

- **Z-index avec Leaflet** : ses panes vont de 400 à 700. Tout overlay au-dessus de la carte doit être `z-[1000]+`. Dropdowns/menus à `z-[1200]` pour passer au-dessus du BasemapPicker (400) et drawers (1100).
- **MapView.activeTool** : mode mixte (prop + state interne). Le parent peut le contrôler mais le map maintient son état si on change via la toolbar.
- **MapView refs** : `parcelsRef`, `onSelectionRef`, `onDrawCompleteRef` — pour ne pas re-monter l'effet des outils pendant qu'on dessine.
- **Labels carte** : ne pas reconstruire le layer GeoJSON à chaque selection change — ça fait trembler les labels permanents. Utiliser `eachLayer().setStyle()`.
- **Toolbar carte** : cachée sur mobile (`isDesktop &&`) — trop complexe à utiliser au doigt.
- **Outil draw-parcel** : utilise `onDrawComplete` callback. Si non fourni, fallback en state local `drawnPolygons`. Coordonnées GeoJSON Polygon en [lng, lat] et ring fermé.
- **Catalogue cultures** : `app/src/modules/assolement/cultures.ts`. 42 entrées, 9 catégories. Ajout d'une nouvelle culture = ajouter une entrée avec key (en-tête anglais), label (FR), color (hex vif), category.
- **Mocks parcelles** : `parcellaire.mocks.ts` lit `darval.geojson.json` au build. Pour ajouter une parcelle de test, l'ajouter dans le geojson ou utiliser l'outil dessin + dialog.
- **resolveOverlaps + mergeAdjacentSameCulture** : helpers de `assolement.helpers.ts`. À appliquer dans cet ordre après chaque modification de segments.
- **Pas d'emoji** dans le code ou l'UI.
- **Tests visuels prioritaires** : Fabien valide via screenshots. Lancer `npm run dev` et synchroniser les attentes par captures.
- **Bascule de techno > patch infini** : si une lib pose 3 problèmes d'affilée, considérer un switch (cf. Maplibre → Leaflet en session 1).
- **Toutes les tables/listes futures** : prévoir d'emblée multi-sélection + actions groupées (cf. mémoire `feedback_tables_multi_select`).
- **Cards entièrement cliquables** (session 4) : pour toute liste / table mobile / vue timeline, la zone entière est cliquable (`role="button" tabIndex={0}` + handler clavier). Plus de bouton "Modifier" séparé. Seul un bouton supprimer reste, avec `stopPropagation`. Cf. mémoire `feedback_cards_full_clickable`.
- **Dev server** : port verrouillé via `strictPort: true` dans `vite.config.ts` — toujours sur **http://localhost:5173**, ne dérive plus.

## Fait en session 4 (2026-05-16)

### Système de droits & utilisateurs (style Odoo)
- `AppUser` enrichi : `phone`, `jobTitle`, `hireDate`, `language`, `permissions`, `odooUserId`, `odooTagId`.
- `users/permissions.ts` : 8 modules × 4 niveaux, défauts par rôle, hook `useCan()`, helper `canAccess()`.
- `UtilisateurDetailPage` style Odoo : Informations / Accès par module (matrice radio avec override fin) / Synchronisation Odoo.
- `users/odoo-mapping.ts` : helpers `userIdsToOdoo{Tag,User,Employee}Ids()` pour le sync Phase 3.

### Refonte Paramètres en layout 2 colonnes
- `ParametresLayout.tsx` + sidebar gauche groupée (Général / Données / Intégrations).
- Routes nestées `/parametres/{section}` avec 9 sections.
- `parametres.sections.tsx` source de vérité (slug, icône, group, permission requise).
- Sections : Exploitation, Utilisateurs, Préférences (`preferences.store` localStorage), Cultures, Produits, Cheptel, Travaux config, Intégration Odoo (avec audit étiquettes FSM), MétéoSuisse.
- `integrations.store.ts` (Odoo + Météo settings + statut sync par entité).

### Module Troupeau MVP
- `livestock.types.ts` + `livestock.catalog.ts` (21 catégories DBF Agroscope 2017) + `livestock.mocks.ts` (cheptel Darval) + `livestock.helpers.ts` + `livestock.store.ts` (localStorage).
- `TroupeauPage` : table groupée par espèce / Dashboard avec KPIs + production effluents par type. Alerte UGB/ha.
- `LivestockEntryModal` : sélecteur catégorie groupé par espèce, auto-fill des normes.

### Module Travaux pour tiers (aligné Odoo Field Service)
- Modèle **multi-lignes + multi-saisies temps** : `WorkOrder` (header) + `WorkOrderLine[]` + `WorkTimeEntry[]`.
- Doc explicite du mapping Odoo FSM en tête de `travaux.types.ts` (task SANS product, products sur sale.order.line uniquement, assignation via tag_ids).
- 21 prestations catalogue (`travaux.catalog.ts`) avec tarifs Agridéa 2024.
- `WorkOrderModal` : sections Informations / Prestations (add/remove dynamiques) / Saisies de temps (add/remove dynamiques) / Facturation / Notes. Champs Odoo : priority, deadline, userIds (chips toggle), tagIds, fsmDone.
- `ParcelMultiPicker` réutilisé avec nouvelle prop `allowEmpty` (un bon peut n'avoir aucune parcelle).
- Helpers `computeLineTotal / computeWorkOrderTotal / computeWorkOrderDuration / computeWorkOrderSurface / durationFromTimes`.
- `WO_STATUS_TO_STAGE` Record exporté pour mapping vers `task.stage_id`.

### Plan de fumure exploitation (Suisse-Bilanz v1.16)
- `suisse-bilanz.helpers.ts` : `computeSuisseBilanz()` consomme parcelles + segments + livestock + imports, retourne besoins par parcelle, décomposition apports N, soldes, couverture %, conformité ±10%, warnings.
- Constantes : `ORGANIC_FIRST_YEAR_EFFICIENCY` (lisier 0.5 / fumier-frais 0.35 / composté 0.2 / fientes 0.6 / compost 0.15), `ATMOSPHERIC_N_KG_HA = 17` (OFEV 2018), `UGB_HA_LIMIT_PLAIN = 3.0` (OPD art. 47).
- `FumureExploitationPage` : Dashboard avec KPIs N/P (BalanceKpi colorée selon conformité) + décomposition apports / Table besoins par parcelle exportable.
- Auto-fill apports minéraux depuis carnet.
- Import DIGIFLUX (HODOFLUX rebrand 2024) avec choix du type d'effluent (coefficient correct selon lisier/fumier/compost).

### Corrections agronomiques (validées par agronome-validator)
- Veau d'engraissement UGB 0.13 → 0.15 (Suisse-Bilanz Annexe 2).
- Truie d'élevage P 19 → 13 kg P₂O₅/an (DBF 2017 alimentation phasée).
- Coefficient HODOFLUX/DIGIFLUX import : configurable selon type effluent (était fixé à 0.5).
- Seuil sous-fertilisation `fumure.helpers.ts` : 80% → 90% (cohérence Suisse-Bilanz v1.16).

### Refonte squelette pages (réponse PO "pages pas user-friendly")
- Les 3 nouvelles pages (Troupeau, Travaux, FumureExploitation) refondues au pattern standard : `flex h-full flex-col` + topbar sticky avec SearchBar + ViewSwitcher + ExportButton + useFabActions.
- Hook `check-page-consistency.sh` validé sans warning sur les 3.
- Cards entièrement cliquables (toute la card = clic), bouton "Modifier" supprimé, seul bouton ⨯ supprimer reste (avec stopPropagation).

### Infra
- Port dev verrouillé `strictPort: true` dans `vite.config.ts` (toujours 5173).
- `useCurrentFarm()` ajouté au store farms + `updateCurrentFarm()` (mutation locale).
- `_styles.ts` séparé de `_shared.tsx` pour Fast Refresh.

## Références

- `docs/4_Phases/HANDOFF.md` — détail technique complet, hiérarchie z-index, structure code
- `Phase0_Components/PHASE_0_SUMMARY.md` — spec des 9 composants
- `docs/2_Architecture/SPEC.md` — source de vérité fonctionnelle
- `docs/3_Features/COMPOSANTS_REUSABLES.md` — props TS des composants Phase 1
- `~/.claude/projects/-Users-fabiencossy-Projects-NewagriQodo/memory/` — mémoire Claude (profil PO, règles UI, infra)
  - `feedback_tables_multi_select.md` — règle multi-sélection pour toutes les tables
  - `MEMORY.md` — index

## Profil PO en deux lignes

Fabien Cossy, fondateur Qodo Digital, exploitant du Domaine Darval (Échallens). Exigeant sur la cohérence visuelle, communique par screenshots, préfère que tu testes en local avant de déployer, n'aime pas les boucles de patch infinies. Toujours répondre en français.
