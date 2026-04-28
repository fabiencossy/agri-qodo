# Agri Qodo — Spec consolidée pour développement

**Version 1.0 — Avril 2026**
**Document de référence pour Claude Code et tout dev sur le projet.**

Ce fichier consolide les 7 documents de design produit (recherche réglementaire, cahier des charges, roadmap, addenda) en une seule source de vérité technique. Il prévaut sur les Word/HTML originaux en cas de divergence.

---

## 1. Vision en une phrase

Agri Qodo est l'**ERP métier de l'exploitation agricole suisse** : conformité PER quotidienne (carnet des champs, Suisse-Bilanz, SRPA, BDTA), gestion commerciale via Odoo Enterprise (bons de commande, facturation groupée, comptabilité), et pilotage économique de la ferme — dans une seule application **mobile + web**, **hors ligne par défaut**, **100 % open source**, intégrée au data space national **agridata.ch**.

Cible primaire : exploitations familiales 20-80 ha en Suisse romande (VD/GE/FR/NE/JU/VS), grandes cultures + élevage + polyculture-élevage. Extension Suisse alémanique et Tessin en V2/V3.

---

## 2. Décisions cadres non négociables

1. **Odoo Enterprise est obligatoire.** Pas de mode standalone. Online ou Odoo.sh. Pas de Community, pas d'OCA.
2. **L'intégration Odoo est gratuite** (incluse dans tous les plans). Pas de surcoût.
3. **100 % open source — licence AGPL v3** (à valider avec un avocat IP suisse avant publication).
4. **Offline-first.** Tout fonctionne sans réseau. Sync différentielle, dédoublonnage automatique.
5. **Multi-canal** : iOS (App Store) + Android (Play Store) + Web responsive (desktop + mobile).
6. **Simplicité radicale.** Un agriculteur de 60 ans sans expérience logiciel doit utiliser l'app sans formation. Saisie d'intervention < 30 secondes.
7. **Vocabulaire métier** dans toute l'UI, jamais informatique (« semis », « épandage », pas « créer enregistrement »).
8. **Stockage suisse** (Infomaniak / Exoscale recommandés). nLPD compliance dès le départ.
9. **Ne jamais redévelopper ce qu'Odoo fait déjà bien** : la paie, la vente directe (POS/eCommerce), la comptabilité socle = Odoo natif. Agri Qodo capture le terrain et alimente Odoo.

---

## 3. Pricing (référence)

- **Gratuit** : 1 module au choix, 1 utilisateur, à vie.
- **Plan unique payant** : **49 CHF/mois (588 CHF/an)** — 2 à 16 modules (autant que voulu), jusqu'à 10 utilisateurs. Au-delà : +8 CHF/utilisateur/mois.
- **Add-ons** : robot de traite (+30 CHF/mois), onboarding accompagné (490 CHF unique), formation (200 CHF/h).
- **Enterprise** : modules Odoo custom (Odoo.sh requis), à partir de 2 500 CHF setup + 50 CHF/mois maintenance par module custom.

---

## 4. Stack technique imposée

### Frontend mobile

- **React Native** + **Expo** (managed workflow pour démarrer)
- **TypeScript** strict
- **WatermelonDB** (sur SQLite) pour la persistance offline + sync
- **expo-router** (file-based routing)
- **NativeWind** (Tailwind pour RN)
- **Zustand** ou Jotai pour le state global
- **react-hook-form** + **zod** pour les formulaires et validation
- **expo-camera**, **expo-location**, **expo-speech-recognition**

### Frontend web

- **Next.js 15** (App Router)
- **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui** (composants accessibles)
- **RxDB** (sur IndexedDB) pour l'offline web
- **TanStack Query** pour les requêtes serveur
- **react-hook-form** + **zod**

### Backend

- **NestJS** + **TypeScript** strict
- **PostgreSQL 16** + **Prisma ORM**
- **OpenAPI 3.1** auto-généré (Swagger UI exposé)
- **JWT** + refresh token, support **CH-Login** (OpenID Connect via Agate)
- **BullMQ** (Redis) pour les jobs asynchrones (sync Odoo, notifications, sync agridata.ch)
- **Pino** pour logs structurés
- **OpenTelemetry** pour la trace

### Données et intégrations

- **PostgreSQL** comme source de vérité (multi-tenant via `tenant_id`)
- **Redis** pour cache + queues
- **Object storage** pour photos (S3-compatible, Exoscale ou MinIO self-hosted CH)
- **Odoo XML-RPC / JSON-RPC** via lib partagée `@agriqodo/odoo-client`
- **agridata.ch** REST API (V2)

### DevOps

- **Monorepo Turborepo** avec **pnpm workspaces**
- **Docker** + **docker-compose** pour le dev local
- **GitHub Actions** pour CI/CD
- **Hébergement prod** : Infomaniak Cloud Server (CH) ou Exoscale (CH)
- **Sentry** pour error tracking
- **Plausible** ou Umami pour analytics (RGPD-compatible, self-hostable)

### Licence

**AGPL v3** sur tout le code applicatif. Modules Odoo custom : **LGPL** (compatible Odoo).

---

## 5. Structure du monorepo

```
agri-qodo/
├── apps/
│   ├── web/                  # Next.js 15
│   ├── mobile/               # React Native + Expo
│   └── backend/              # NestJS
├── packages/
│   ├── shared/               # types, schémas zod, modèles partagés
│   ├── ui/                   # composants partagés web
│   ├── odoo-client/          # lib XML-RPC/JSON-RPC Odoo
│   ├── agridata-client/      # lib REST agridata.ch
│   └── domain/               # logique métier pure (Suisse-Bilanz, calculs UGB...)
├── docs/
│   ├── SPEC_COMPLETE.md      # ce fichier
│   ├── ARCHITECTURE.md
│   ├── MODULES/              # une fiche par module M1...M16
│   └── adr/                  # Architecture Decision Records
├── infra/
│   ├── docker-compose.dev.yml
│   └── deploy/
├── .github/workflows/
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
├── README.md                 # public, FR
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE                   # AGPL v3
└── CLA.md
```

---

## 6. Modèle de données central

Cinq entités-pivot, toutes multi-tenant via `tenant_id` :

| Entité                  | Rôle                                                      | Particularité                             |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `Exploitation` (tenant) | Racine, n° BDTA, n° canton, code Agri Qodo unique         | code = `AQ-{canton}-{n°ufam}-{token4}`    |
| `Parcelle`              | ID cadastral, surface, géométrie, zone agricole           | Géoloc PostGIS                            |
| `Culture` (occupation)  | Espèce + variété + période sur une parcelle/an            | History versionnée                        |
| `Intervention`          | Action datée sur parcelle (semis, fumure, phyto, récolte) | Append-only, UUID client pour idempotence |
| `Animal` / `LotAnimal`  | BDTA, catégorie, mouvements                               | Sync avec Identitas                       |

Plus, pour M16 :

- `PartnerLink` — liaison entre exploitations (entrepreneur ↔ client) avec scope JSON et niveau d'autorisation.

---

## 7. Modules — catalogue complet

### Phase MVP (mois 0-6)

**M1 Parcellaire et assolement** — fondation. Import GIS cantonal (geo.vd.ch, sitg.ge.ch...), édition manuelle, historique d'assolement. Calcul auto du respect de l'assolement régulier.

**M2 Carnet des champs** — saisie mobile PWA offline, catalogue produits homologués (sync OFAG), saisie voix, photos, signature électronique, alertes délais d'attente, export PDF officiel.

**M3 Suisse-Bilanz** — calcul auto selon Guide 1.18, simulation prévisionnelle, alerte temps réel, export PDF + CSV. Conservation 6 ans.

**M4 Animaux et BDTA** — registre individuel/lot, notifications BDTA en un clic, calcul UGB. (V2 : robot de traite, comptes individuels.)

**M5 SRPA Journal des sorties** — saisie quotidienne en 5 secondes, géo-tag, alertes défaut de sortie, registre annuel.

**M6 Bons de commande + facturation groupée** — bon de travail mobile → `sale.order` Odoo → accumulation par client → facturation groupée mensuelle (`sale.advance.payment.inv`). TVA auto (2.6 % travail du sol, 8.1 % autres). QR-bill.

**M15 Documentation et veille réglementaire** — bibliothèque OPD/OPPh/etc. avec résumés, guides Agridea, glossaire métier, calendrier réglementaire, alertes push, recherche unifiée, hors ligne. Disponible en plan Gratuit (canal d'acquisition principal).

**M16 Lien partenaire entre exploitations (NOUVEAU)** — code d'exploitation unique, demande d'autorisation push, autorisations granulaires (parcelles + niveaux), workflow validation avec photo/géoloc. Une seule saisie côté entrepreneur = carnet des champs côté client + bon de commande côté entrepreneur. Effet viral d'acquisition.

### Phase V2 (mois 7-12)

**M4 complet** — BDTA en écriture, intégration robot de traite Lely/DeLaval/GEA.

**M7 Surfaces de promotion biodiversité (SPB)** — calcul auto ratio SPB/SAU, dates fauche autorisées, alertes traitement sur SPB, mise en réseau.

**M8 Stocks intrants et récoltes** — FIFO/LIFO, dates péremption phyto, rapprochement consommations terrain ↔ achats Odoo.

**M10 Comptabilité agricole CH** — plan comptable agricole (Agriexpert), TVA agricole (2.6 % / 8.1 %), exonération produits propres, bouclement annuel.

**M14 Connecteur agridata.ch / DigiAgriFoodCH** — REST API + auth token, gestion consentements utilisateur, import/export depuis/vers le data space national.

### Phase V3 (mois 13-24)

**M11 Heures et présences** — pointage mobile géolocalisé, affectation par parcelle/opération, calendrier équipe, validation hebdo, export feuilles de temps validées vers `hr.timesheet` + `hr.attendance` Odoo. **Les salaires eux-mêmes sont gérés par Odoo HR/Payroll** (Swissdec), pas par Agri Qodo.

**M12 Pilotage économique** — marge brute par parcelle/culture, marge par UGB, simulateur paiements directs, benchmarking anonymisé.

**M13 Multi-exploitation et coopération** — CUMA, communautés d'exploitation, partage matériel, refacturation interne.

### Hors périmètre Agri Qodo

**M9 Vente directe / circuits courts** — couvert nativement par Odoo POS, eCommerce, Subscriptions, Loyalty. Agri Qodo se contente de pousser les lots de récolte dans Odoo Inventory.

---

## 8. Intégrations externes — détail

| Système                                                   | Type                             | Phase                        |
| --------------------------------------------------------- | -------------------------------- | ---------------------------- |
| Odoo Enterprise (XML-RPC + JSON-RPC)                      | Bidirectionnel                   | MVP                          |
| BDTA / Identitas                                          | API REST                         | MVP (lecture), V2 (écriture) |
| HODUFLU                                                   | API                              | V2                           |
| Acorda (VD/GE/NE/JU)                                      | Export CSV/PDF puis API si dispo | V2                           |
| GELAN (BE/FR/SO)                                          | Export CSV/PDF puis API si dispo | V2                           |
| Agriportal (TI)                                           | À étudier                        | V2                           |
| Agate (CH-Login OIDC)                                     | SSO                              | MVP                          |
| MeteoSwiss                                                | API publique                     | MVP                          |
| OFAG OPPh (catalogue produits homologués)                 | Téléchargement mensuel           | MVP                          |
| GIS cantonaux (geo.vd.ch, sitg.ge.ch...)                  | WMS/WFS                          | MVP                          |
| Suissemilk / SwissGenetics                                | API                              | V2                           |
| Robots de traite (Lely T4C, DeLaval DelPro, GEA DairyNet) | API/SFTP                         | V2 (add-on)                  |
| agridata.ch (data space national)                         | REST + token                     | V2                           |

---

## 9. UX — règles directrices

- **Vocabulaire métier** : « semis », « épandage », « vêlage » — jamais « créer enregistrement », « valider transaction ».
- **Une seule action principale par écran**. Le bouton vert au milieu doit être évident.
- **Saisie progressive** : ne demander que ce qui est strictement nécessaire à cet instant.
- **Mémoire intelligente** : pré-remplir avec parcelle / produit / machine récents.
- **Pas de formulaires longs** : découper en 3-5 étapes courtes avec sauvegarde auto.
- **Erreurs en français paysan** : « il manque la quantité d'engrais », pas « validation error ».
- **Saisie vocale et photo OCR natives**.
- **Onboarding contextuel** (info-bulles à l'usage), pas de tunnel forcé.
- **Mode hors ligne par défaut**.
- **Accessibilité** : zones de tap larges (gants en hiver), contraste élevé (soleil au champ).

**Critère de succès** : un agriculteur de 60 ans sans expérience logiciel doit pouvoir, sans formation ni support :

1. Créer son exploitation et ses parcelles
2. Saisir une intervention phyto en < 30 secondes sur mobile
3. Émettre un bon de commande pour un travail tiers en < 60 secondes
4. Consulter son Suisse-Bilanz à jour en < 2 minutes

Si l'une de ces 4 actions exige assistance, le produit a échoué.

---

## 10. Architecture offline-first — points clés

- Toutes les écritures persistent d'abord localement (SQLite mobile, IndexedDB web).
- UUID client par opération (idempotence à la sync).
- Sync différentielle, non bloquante.
- Indicateur de sync visible en permanence.
- Détection doublons techniques (UUID identique) et sémantiques (même parcelle + produit + date ±2h).
- Conflits :
  - Intervention (immutable) : append-only, pas de conflit
  - Parcelle (mutable) : Last-Write-Wins serveur, log d'audit
  - Animal (mutable) : verrou optimiste avec versioning, conflit explicite à résoudre par l'utilisateur
- Stockage local : cible < 200 Mo mobile pour 3 ans d'historique. Chiffrement local des données sensibles (SQLCipher mobile, WebCrypto web).
- Tests E2E en mode avion **obligatoires** avant chaque release.

---

## 11. Modèle technique M16 — Lien partenaire (à coder en MVP)

```typescript
// Schema Prisma
model PartnerLink {
  id              String   @id @default(uuid())
  ownerTenantId   String   // l'exploitation propriétaire des parcelles
  partnerTenantId String   // l'entrepreneur qui intervient
  scope           Json     // { parcelles: 'all' | uuid[], niveau: 'lecture' | 'validation' | 'direct' }
  status          String   // 'pending' | 'active' | 'revoked'
  grantedAt       DateTime?
  revokedAt       DateTime?
  createdAt       DateTime @default(now())

  @@unique([ownerTenantId, partnerTenantId])
}

model Intervention {
  // ... champs habituels
  authorTenantId  String   // qui a saisi (peut être un partenaire)
  ownerTenantId   String   // à qui appartient la parcelle
  validationStatus String  // 'self' | 'pending' | 'validated' | 'rejected'
  validatedAt     DateTime?
  rejectedReason  String?
}
```

Workflow :

1. Entrepreneur saisit code `AQ-VD-1247-XR3K` du client.
2. Client reçoit notification push « Untel demande l'accès à votre exploitation ».
3. Client choisit le scope (toutes parcelles ou liste) et le niveau (lecture / validation / direct).
4. Lien actif. L'entrepreneur voit les parcelles autorisées dans son app, marquées « client externe ».
5. Entrepreneur saisit une intervention (épandage 25 doses, parcelle 12).
6. Si niveau = validation : intervention créée avec `validationStatus='pending'`, notif au client.
7. Client valide → `validationStatus='validated'`, intervention écrite dans son carnet (M2). Génère ligne `sale.order.line` côté entrepreneur (M6).
8. Client refuse → `validationStatus='rejected'`, motif obligatoire, retour à l'entrepreneur.

Audit trail complet, RGPD/nLPD. Révocation à tout moment depuis les paramètres.

---

## 12. Sécurité, conformité, multi-tenant

- **Isolation tenant stricte** : tous les modèles ont `tenant_id`, middleware Prisma qui force le filtre.
- **nLPD compliance** : registre des activités, droits d'accès aux personnes concernées, DPO désigné, hébergement CH.
- **Chiffrement** : TLS 1.3 obligatoire, données au repos chiffrées (PostgreSQL + objet storage).
- **Backup** : quotidien, restauration testée mensuellement.
- **2FA** disponible (TOTP), obligatoire pour les comptes Enterprise.
- **Audit log** immuable pour les actions sensibles (consentements, partages M16, interventions phyto).

---

## 13. Roadmap MVP — 6 mois suggérés

| Mois | Objectif                                                              |
| ---- | --------------------------------------------------------------------- |
| 1    | Bootstrap monorepo, CI/CD, auth, M1 Parcellaire en lecture seule      |
| 2    | M1 complet, M2 Carnet champs (saisie offline), M15 (contenu de base)  |
| 3    | M3 Suisse-Bilanz (calcul local), M4 Animaux (registre + lecture BDTA) |
| 4    | M5 SRPA, M6 Bons de commande + intégration Odoo                       |
| 5    | M16 Lien partenaire (cas d'usage central), peaufinage UX              |
| 6    | Apps stores (iOS, Android), tests pilotes 5-10 exploitations VD/FR    |

---

## 14. Sources documentaires officielles

OFAG : https://www.blw.admin.ch/fr/prestations-ecologiques-requises ・ https://www.blw.admin.ch/fr/paiements-directs ・ https://www.blw.admin.ch/fr/application-agate ・ https://www.blw.admin.ch/fr/application-bdta ・ Train d'ordonnances 2026

Agridea : Guide Suisse-Bilanz 1.18 ・ Dossier PER Romandie 2026 ・ fiches SST/SRPA

agridata.ch / digiagrifood.ch : https://digiagrifood.ch/fr/ ・ contact info@digiagrifood.ch

Identitas / BDTA : https://www.bdta.ch/

OPD texte intégral : https://www.admin.ch/opc/fr/classified-compilation/20130216/

---

**Fin de la spec consolidée.**
