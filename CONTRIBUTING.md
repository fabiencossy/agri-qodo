# Contribuer à Agri Qodo

Merci de t'intéresser au projet ! Ce guide explique comment contribuer efficacement.

## Code de conduite

Toute participation au projet est régie par le [Code de conduite](CODE_OF_CONDUCT.md) (Contributor Covenant 2.1).

## CLA — Contributor License Agreement

Avant ta première contribution, tu dois signer le [CLA](CLA.md). Sans cela, ta PR ne pourra pas être mergée.

## Mise en route

```bash
git clone https://github.com/agri-qodo/agri-qodo.git
cd agri-qodo
nvm use            # Node 22 LTS
pnpm install
docker-compose -f infra/docker-compose.dev.yml up -d
pnpm dev
```

## Conventions

### Langue

- **UI** : exclusivement en français, vocabulaire métier (« semis », « épandage », pas « créer enregistrement »).
- **Code et commentaires** : anglais.
- **Documentation utilisateur** (`docs/`, `README`, `CONTRIBUTING`) : français.
- **ADR** : français.

### TypeScript

- **Strict** partout, sans exception. Pas de `any` — utilise `unknown` et narrow.
- `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` activés.
- Schémas runtime via `zod` au boundary (API, formulaires).

### Commits

Conventional commits stricts :

```
feat(M1): ajout import GeoJSON parcelles
fix(auth): refresh token expiré ne renvoie plus 500
docs(adr): ADR-007 choix WatermelonDB pour offline mobile
chore: bump turbo 2.3.3
```

Types autorisés : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Le hook commitlint refuse les messages non conformes.

### Branches

- `main` est protégée. Aucun push direct.
- Une branche par feature ou fix : `feat/m1-parcellaire-import`, `fix/auth-refresh`.
- Une PR par contribution. CI verte obligatoire avant merge.
- Pas de force push sur `main`.

### Tests

- Logique métier (`packages/domain/`) : 100 % couverte.
- Backend modules : tests unitaires + e2e sur les endpoints critiques.
- Frontend : tests d'intégration sur les parcours clés.
- **E2E mobile en mode avion** obligatoire avant chaque release (saisie offline + sync).

### Documentation

- Toute décision technique structurante → un **ADR** dans `docs/adr/` (format MADR).
- Tout nouveau module → fiche `docs/modules/M{n}.md` mise à jour.
- Toute donnée personnelle traitée → entrée dans `docs/data-protection.md`.

### Sécurité

- Aucun secret en dur dans le code ou les commits.
- `.env` est gitignored, `.env.example` est committé (template vide ou valeurs factices).
- Données sensibles chiffrées au repos (SQLCipher mobile, WebCrypto web, PostgreSQL côté serveur).
- Vulnérabilité ? Écris à `security@agri-qodo.ch` (ne pas ouvrir d'issue publique).

## Processus de PR

1. Fork ou branche depuis `main` à jour.
2. Code + tests + doc.
3. `pnpm lint && pnpm typecheck && pnpm test` doivent passer en local.
4. Commit avec conventional commits.
5. Push et ouvre la PR avec description claire (problème → solution → impact).
6. Review d'au moins 1 mainteneur. Mods demandés → tu mets à jour ; pas de comportement passif-agressif.
7. Squash and merge une fois la CI verte et la review approuvée.

## Discussion et entraide

- Issues GitHub pour les bugs et propositions de features.
- Discussions GitHub pour les questions ouvertes et l'architecture.
- Signe ton message si tu représentes une exploitation ou un acteur du milieu agricole — ça aide à prioriser.

## Pour les développeurs débutants

Tu as commenté une PR, posé une question dans une issue ou proposé une amélioration de doc ? **Tu contribues déjà.** N'hésite pas. La barrière à l'entrée est basse, et on prend le temps d'expliquer.

Bonnes contributions ! 🌾
