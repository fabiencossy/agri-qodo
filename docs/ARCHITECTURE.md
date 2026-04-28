# Architecture d'Agri Qodo

> Document vivant — toute décision structurante donne lieu à un ADR dans `docs/adr/`. Ce fichier offre la vue d'ensemble.

## Vue 30 000 pieds

```
┌─────────────────────────────────────────────────────────────────┐
│                      Utilisateur agriculteur                     │
└──────────┬─────────────────┬──────────────────┬────────────────┘
           │                 │                  │
      ┌────▼─────┐      ┌────▼─────┐      ┌─────▼────┐
      │  Mobile  │      │   Web    │      │  Mobile  │
      │   iOS    │      │ Next.js  │      │ Android  │
      │  (Expo)  │      │   PWA    │      │  (Expo)  │
      └────┬─────┘      └────┬─────┘      └────┬─────┘
           │                 │                  │
           │ JWT + REST      │                  │
           │ (offline-first) │                  │
           └─────────┬───────┴──────────────────┘
                     │
                     ▼
           ┌──────────────────────┐
           │   Backend NestJS     │
           │  (multi-tenant API)  │
           │   OpenAPI 3.1        │
           └─┬─────┬────────┬─────┘
             │     │        │
   ┌─────────▼┐  ┌─▼────┐  ┌▼─────────────┐
   │PostgreSQL│  │Redis │  │   BullMQ     │
   │ +PostGIS │  │      │  │ jobs async   │
   └──────────┘  └──────┘  └──┬───────────┘
                              │
            ┌─────────────────┼─────────────────────┐
            │                 │                     │
       ┌────▼─────┐    ┌──────▼──────┐    ┌────────▼─────────┐
       │  Odoo    │    │    BDTA /   │    │  agridata.ch     │
       │Enterprise│    │  Identitas  │    │  (data space CH) │
       └──────────┘    └─────────────┘    └──────────────────┘
```

## Principes architecturaux

### 1. Offline-first

Toute écriture persiste **d'abord** sur le client (WatermelonDB sur mobile, RxDB sur web). La sync est différentielle, non bloquante, idempotente (UUID client).

Trois stratégies de conflit selon la nature de l'entité :

- **Intervention** : append-only, pas de conflit possible.
- **Parcelle** : Last-Write-Wins côté serveur, log d'audit immuable.
- **Animal** : verrou optimiste (version), conflit explicite levé à l'utilisateur.

Indicateur de sync **toujours visible** dans l'UI (pastille verte/orange/rouge en haut de l'écran).

### 2. Multi-tenant strict

Toutes les entités portent `tenantId`. Un middleware Prisma force le filtre sur chaque requête authentifiée. Aucun endpoint ne renvoie de données sans `tenantId` validé contre la session JWT.

Cas particulier M16 (lien partenaire) : un utilisateur peut être autorisé à voir/écrire sur les parcelles d'un _autre_ tenant via une `PartnerLink` active. Le filtre Prisma est étendu pour inclure les tenants accessibles via lien actif, avec scope respecté.

### 3. Séparation domaine / framework

`packages/domain/` = logique métier **pure** (Suisse-Bilanz, UGB, assolement, validation parcelle), sans aucune dépendance d'I/O ni de framework. Cible : 100 % de couverture de tests.

Le backend NestJS, le web Next.js et le mobile Expo importent tous `@agri-qodo/domain` pour appliquer les mêmes règles métier.

### 4. Source de vérité unique côté serveur

PostgreSQL est la source de vérité. Les clients (web + mobile) ont une copie locale qui se réconcilie via sync. L'export Odoo est _en aval_ — Odoo est le système de facturation/comptabilité, mais Agri Qodo reste l'autorité sur les données métier (interventions, parcelles, animaux).

### 5. Ne jamais redévelopper Odoo

Tout ce qu'Odoo fait bien (paie via Swissdec, POS, eCommerce, comptabilité socle) reste dans Odoo. Agri Qodo capture le terrain et **alimente** Odoo via le connecteur `@agri-qodo/odoo-client`.

## Topologie du monorepo

| Couche           | Packages                                                    | Dépend de                     |
| ---------------- | ----------------------------------------------------------- | ----------------------------- |
| **Apps**         | `@agri-qodo/backend`, `@agri-qodo/web`, `@agri-qodo/mobile` | tous les packages             |
| **UI**           | `@agri-qodo/ui`                                             | `shared`                      |
| **Intégrations** | `@agri-qodo/odoo-client`, `@agri-qodo/agridata-client`      | `shared`                      |
| **Domaine**      | `@agri-qodo/domain`                                         | aucun (zéro dépendance d'I/O) |
| **Socle**        | `@agri-qodo/shared`                                         | aucun                         |

Règle absolue : **les flèches de dépendance ne remontent jamais.** Le domaine ne connaît rien d'Odoo. Shared ne connaît rien de NestJS.

## Choix techniques majeurs (renvois ADR)

- ADR-001 : Stack monorepo (Turborepo + pnpm + NestJS + Next.js + Expo) — **rédigé**
- ADR-002 : Stratégie multi-tenant strict (3 couches : ALS + Prisma extension + tests) — **rédigé**
- ADR-003 : Choix de la persistance offline mobile (WatermelonDB) — _à rédiger_
- ADR-004 : Choix de la persistance offline web (RxDB) — _à rédiger_
- ADR-005 : Connecteur Odoo (XML-RPC + JSON-RPC en lib partagée) — _à rédiger_
- ADR-006 : Modèle de sync différentielle et résolution de conflits — _à rédiger_

## Sécurité et conformité — résumé

Voir [`SPEC_COMPLETE.md`](SPEC_COMPLETE.md) §12 pour le détail.

- TLS 1.3, chiffrement au repos (PostgreSQL + storage), SQLCipher mobile.
- nLPD : registre des traitements, DPO désigné, hébergement Suisse.
- Audit log immuable pour interventions phyto, partages M16, consentements.
- 2FA TOTP disponible (obligatoire en Enterprise).

## Observabilité

- **Logs** : Pino structurés JSON, agrégés vers Loki.
- **Trace** : OpenTelemetry, exportées vers Tempo (ou Jaeger).
- **Métriques** : Prometheus + Grafana.
- **Erreurs** : Sentry (app + backend).
- **Analytics** : Plausible self-hostable (RGPD/nLPD compatible).
