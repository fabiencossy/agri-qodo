# 🌱 Agri Qodo

> L'ERP métier de l'exploitation agricole suisse — open source, hors ligne, intégré à Odoo.

**Statut : 🌱 alpha — early development**

Agri Qodo est une application **mobile + web**, **hors ligne par défaut**, qui aide les exploitations agricoles suisses à tenir leur conformité PER quotidienne (carnet des champs, Suisse-Bilanz, SRPA, BDTA), à gérer leur activité commerciale via Odoo Enterprise (bons de commande, facturation groupée, comptabilité), et à piloter l'économie de leur ferme — le tout dans une seule app, **100 % open source** (AGPL v3), avec stockage en Suisse.

Cible primaire : exploitations familiales 20-80 ha en Suisse romande, grandes cultures + élevage + polyculture-élevage.

## Promesse produit

Un agriculteur de 60 ans sans expérience logiciel doit pouvoir, **sans formation ni support** :

1. Créer son exploitation et ses parcelles
2. Saisir une intervention phyto en moins de 30 secondes sur mobile
3. Émettre un bon de commande pour un travail tiers en moins de 60 secondes
4. Consulter son Suisse-Bilanz à jour en moins de 2 minutes

Si l'une de ces 4 actions exige assistance, le produit a échoué.

## Stack technique

- **Monorepo** : Turborepo + pnpm workspaces
- **Backend** : NestJS + TypeScript strict + Prisma + PostgreSQL 16 (PostGIS) + Redis + BullMQ
- **Web** : Next.js 15 (App Router) + Tailwind + shadcn/ui + RxDB
- **Mobile** : React Native + Expo + WatermelonDB + NativeWind
- **Intégrations** : Odoo Enterprise (XML-RPC/JSON-RPC), agridata.ch, BDTA, Agate (CH-Login), MeteoSwiss, GIS cantonaux
- **Hébergement** : Suisse (Infomaniak / Exoscale)

## Prérequis

- **Node.js 22 LTS** (voir `.nvmrc`)
- **pnpm 9.x** (`npm install -g pnpm@9` ou `corepack enable`)
- **Docker** + **docker-compose** (pour PostgreSQL, Redis, Mailhog en dev)
- **git**

## Démarrage rapide

```bash
# Installer les dépendances
pnpm install

# Lancer les services dev (Postgres + Redis + Mailhog)
docker-compose -f infra/docker-compose.dev.yml up -d

# Lancer toutes les apps en mode dev
pnpm dev
```

Les commandes principales :

| Commande         | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm install`   | Installation des dépendances                |
| `pnpm dev`       | Lance toutes les apps en mode développement |
| `pnpm build`     | Build de production de toutes les apps      |
| `pnpm lint`      | Vérification ESLint sur tout le monorepo    |
| `pnpm typecheck` | Vérification TypeScript                     |
| `pnpm test`      | Lance la suite de tests                     |
| `pnpm format`    | Formate le code avec Prettier               |

Pour cibler une app/package précis : `pnpm --filter <name> <commande>` (ex : `pnpm --filter backend dev`).

## Structure du monorepo

```
agri-qodo/
├── apps/
│   ├── web/          # Next.js 15
│   ├── mobile/       # React Native + Expo
│   └── backend/      # NestJS
├── packages/
│   ├── shared/       # types partagés, schémas zod
│   ├── ui/           # composants partagés web
│   ├── odoo-client/  # lib XML-RPC / JSON-RPC Odoo
│   ├── agridata-client/  # lib REST agridata.ch
│   └── domain/       # logique métier pure (Suisse-Bilanz, UGB, etc.)
├── docs/             # spec, architecture, ADR, fiches modules
└── infra/            # docker-compose dev, configs déploiement
```

Voir [`docs/SPEC_COMPLETE.md`](docs/SPEC_COMPLETE.md) pour la spécification consolidée et [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour les choix techniques.

## Modules

**MVP (mois 0-6)** : M1 Parcellaire, M2 Carnet des champs, M3 Suisse-Bilanz, M4 Animaux/BDTA (lecture), M5 SRPA, M6 Bons de commande + facturation groupée, M15 Veille réglementaire, M16 Lien partenaire.

**V2 (mois 7-12)** : BDTA en écriture, robots de traite, M7 SPB, M8 Stocks, M10 Comptabilité agricole CH, M14 agridata.ch.

**V3 (mois 13-24)** : M11 Heures et présences, M12 Pilotage économique, M13 Multi-exploitation et coopération.

Détail complet par module dans [`docs/modules/`](docs/modules/).

## Contribuer

Toute contribution est la bienvenue ! Lis d'abord [`CONTRIBUTING.md`](CONTRIBUTING.md) et signe le [`CLA.md`](CLA.md) avant ta première PR.

Code de conduite : [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) (Contributor Covenant 2.1).

## Licence

[**AGPL v3**](LICENSE) — toute modification déployée sur un serveur public doit être publiée sous la même licence.

Les modules Odoo custom sont publiés en **LGPL** (compatibilité Odoo).

---

Fait avec 🌾 en Suisse.
