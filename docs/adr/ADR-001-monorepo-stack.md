# ADR-001 — Stack du monorepo

- **Statut** : Accepté
- **Date** : 2026-04-28
- **Décideurs** : Fabien Cossy (porteur projet), Claude Code (assistant)

## Contexte et énoncé du problème

Agri Qodo cible 3 canaux (iOS, Android, web) avec backend partagé, hors ligne par défaut, intégration Odoo Enterprise obligatoire, et publication open source AGPL v3. Il faut une organisation de code qui :

1. Permet le partage de logique métier (Suisse-Bilanz, UGB, validation parcelle) entre les 3 canaux.
2. Supporte un développement en TypeScript strict de bout en bout.
3. Tient en CI/CD raisonnable (build < 5 min sur GitHub Actions).
4. Reste lisible pour des contributeurs externes (le projet est open source).

## Décision

Adopter un **monorepo Turborepo** + **pnpm workspaces**, avec :

- 3 apps : `apps/backend` (NestJS), `apps/web` (Next.js 15), `apps/mobile` (React Native + Expo managed).
- 5 packages internes : `packages/{shared,ui,odoo-client,agridata-client,domain}`.
- Toutes en TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

Package manager pinné : **pnpm 9.15.0** (champ `packageManager` dans `package.json` racine).

Node : **22 LTS** (fichier `.nvmrc`).

## Alternatives considérées

### Polyrepo (3 repos séparés)

- ➕ Isolation forte, deploy indépendant par app.
- ➖ Duplication de code (types, validation, constantes), versioning compliqué pour `@agri-qodo/domain`, friction pour les contributeurs.
- **Rejeté** : la promesse offline-first impose le partage de logique entre canaux.

### Nx au lieu de Turborepo

- ➕ Plus de plugins (Cypress, Storybook), graphe de dépendances visuel.
- ➖ Plus opinionné, courbe d'apprentissage plus raide, fichiers de config nombreux.
- **Rejeté** : Turborepo est plus simple, suffisant pour notre échelle, et son `turbo.json` est plus lisible.

### npm/yarn workspaces

- ➖ pnpm est plus rapide, gère mieux le hoisting strict (essentiel avec React Native qui résiste au hoisting), et impose une structure de `node_modules` qui détecte les imports fantômes.
- **Rejeté** : pnpm est le standard de facto en 2026 sur les monorepos TypeScript.

### Bun

- ➕ Performances excellentes, runtime intégré.
- ➖ Encore jeune sur l'écosystème React Native/Expo et NestJS, instabilité possible côté Prisma (à mai 2026).
- **Rejeté pour le moment** : risque trop élevé pour un projet en bootstrap. À réévaluer en V2.

## Conséquences

### Positives

- Logique métier (`@agri-qodo/domain`) écrite **une seule fois**, importée partout.
- Refactor cross-canal en une PR (renommer un type, modifier un schéma → un seul commit).
- TypeScript strict force la qualité dès le départ.
- Turborepo cache les builds → CI rapide.

### Négatives

- Premier setup plus lourd (1 jour de bootstrap vs 1 heure pour un repo unique).
- Les contributeurs doivent comprendre pnpm workspaces (rare obstacle).
- Mobile (React Native + Expo) résiste au hoisting strict — il faut parfois ajouter des paquets en `dependencies` directes.

### Compromis acceptés

- Le bundle web emporte `@agri-qodo/shared` et `@agri-qodo/domain` — accepté car ces packages sont volontairement légers (zéro dépendance d'I/O).
- Le mobile peut nécessiter des shims pour Node-only APIs dans les packages partagés. Solution : garder `@agri-qodo/domain` strictement isomorphe (pas d'`fs`, pas de `crypto-node`).

## Suivi

- Mesurer la durée des builds CI à chaque release MVP (cible < 5 min full + < 90 s incrémental).
- Si le monorepo dépasse 30 packages, réévaluer (passage à Nx envisageable).
