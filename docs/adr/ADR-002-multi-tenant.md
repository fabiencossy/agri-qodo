# ADR-002 — Stratégie multi-tenant strict

- **Statut** : Accepté
- **Date** : 2026-04-28
- **Décideurs** : Fabien Cossy (porteur), Claude Code (assistant)
- **Lié** : SPEC §12 (Sécurité, conformité, multi-tenant)

## Contexte

Agri Qodo héberge les données d'exploitations agricoles distinctes sur **une seule base PostgreSQL partagée**. Chaque exploitation est un _tenant_. La promesse produit (et l'exigence nLPD) impose qu'un tenant ne puisse **jamais** voir, lire, modifier ou supprimer les données d'un autre tenant — même par accident de développement.

Trois exigences non négociables :

1. **Garantie technique**, pas conventionnelle. Si un dev oublie un filtre `where: { tenantId }`, l'isolation doit tenir.
2. **Modèle de menace explicite** documenté.
3. **Tests qui prouvent l'isolation** et qui s'exécutent à chaque CI.

## Décision

**Trois couches de défense superposées :**

### Couche 1 — Contexte tenant en AsyncLocalStorage

`TenantContextService` (cf. `src/common/tenant/tenant-context.service.ts`) maintient pour chaque requête HTTP un `{ tenantId, userId }`.

- Un middleware Express global (`tenant-context.middleware.ts`) wrappe **chaque requête** dans `als.run({}, () => next())`. Sans ce wrap, toute tentative de set throw — fail loud.
- Le `JwtAuthGuard` appelle `tenantContext.set(...)` après authentification réussie. Le payload JWT est la **seule** source de vérité du tenantId — un client ne peut pas le forger sans casser la signature JWT.
- Tout le reste du pipeline (controllers, services, Prisma extension) lit le contexte via `tenantContext.get()` ou `tryGet()`.

### Couche 2 — Extension Prisma

`buildTenantExtension()` (cf. `src/common/prisma/tenant.middleware.ts`) intercepte **toutes les opérations** sur les modèles tenant-scoped et :

- Injecte `where.tenantId = current` sur `findFirst`, `findFirstOrThrow`, `findMany`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`.
- Injecte `data.tenantId = current` sur `create`, `createMany`, `createManyAndReturn`, `upsert`.
- **Throw `ForbiddenException`** si l'appelant force un `tenantId` différent de celui du contexte (tentative cross-tenant).
- **Interdit `findUnique` / `findUniqueOrThrow`** sur modèles tenant-scoped : ces opérations exigent une clé unique, ce qui empêche d'ajouter le filtre. Erreur claire : « utiliser `findFirst({ where: { id, ... } })` ».

Les services métier accèdent au client via `prisma.tenantAware.X.findMany(...)` — **sans** passer `tenantId` explicitement. Si un dev oublie le préfixe `tenantAware`, l'extension n'est pas appliquée → c'est lisible à la review.

#### Modèles tenant-scoped (filtre auto)

- `Parcelle`
- `Culture`
- `Animal`
- `LotAnimal`

#### Modèles HORS du filtre auto (filtre manuel obligatoire)

- `Exploitation` — c'est le tenant lui-même, filtré par `id`.
- `User`, `RefreshToken` — filtrés par `userId` (le JWT lie un user à un tenant, donc transitivement isolé).
- `Intervention` — deux fields tenant (`ownerTenantId` + `authorTenantId`) à cause de M16 (lien partenaire). Le filtre par défaut sera `OR: [{ ownerTenantId }, { authorTenantId }]`. Logique métier dans `InterventionsService`.
- `PartnerLink` — deux fields (`ownerTenantId` + `partnerTenantId`). Filtre dans `PartnerLinksService`.

### Couche 3 — Tests d'isolation e2e

`test/tenant-isolation.e2e-spec.ts` met en place 2 tenants A et B avec des données distinctes et vérifie :

- `GET /api/parcelles` côté A retourne **uniquement** les parcelles de A.
- `findFirst({ where: { id } })` avec un id appartenant à B retourne `null` côté A (pas d'AccessDeniedException, juste un not-found — évite l'exfiltration de l'existence).
- `create({ data: { tenantId: B } })` côté A → `ForbiddenException`.
- `findUnique` sur modèle tenant-scoped → erreur claire incitant à utiliser `findFirst`.
- Hors contexte (seed/admin) : extension transparente.

Ces tests sont obligatoires en CI. Les ajouter à la CI globale est un pré-requis avant d'aller en production.

## Modèle de menace

| Menace                                               | Couche qui bloque                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Dev oublie `where: { tenantId }` dans un service     | Couche 2 — extension Prisma injecte automatiquement                                           |
| Client force `tenantId` dans le body POST            | Couche 2 — `ensureDataTenant()` throw si divergence                                           |
| Client manipule l'URL avec un `id` d'un autre tenant | Couche 2 — `injectWhere()` ajoute `tenantId`, `findFirst` retourne `null`                     |
| Compromission JWT secret                             | **Hors scope** — la rotation des secrets et la révocation au niveau infra restent nécessaires |
| SQL injection via raw query                          | **Hors scope** — pas de `$queryRawUnsafe` côté applicatif (audit visuel + lint)               |
| Accès direct à la DB (DBA, attaquant interne)        | **Hors scope** — règles d'accès Postgres au niveau infra (RLS Postgres envisageable en V2)    |

## Alternatives considérées

### Postgres Row-Level Security (RLS)

Mettre la règle au niveau de la DB : `CREATE POLICY tenant_isolation ON parcelles USING (tenant_id = current_setting('app.tenant_id'))`.

- ➕ Garantie ultime — même un dev avec un script Node ad-hoc qui oublie le filtre verra ses queries filtrées.
- ➖ Complexité opérationnelle : `SET LOCAL app.tenant_id` à chaque transaction. Friction avec Prisma (migrations, connection pooling).
- ➖ Performance : les politics RLS ajoutent du coût aux plans EXPLAIN, parfois sub-optimal.

**Décision :** RLS est désirable en V2 (couche 4), pas bloquant pour MVP. Couches 1+2+3 sont déjà robustes.

### One DB schema per tenant

- ➕ Isolation absolue, dump/restore par tenant trivial.
- ➖ N'évolue pas (pour 1000 tenants, 1000 schemas, 1000 sets de migrations à appliquer). Connection pooling complexe.
- **Rejeté** pour l'échelle visée (10⁴ exploitations CH max).

### One DB cluster per tenant

- ➕ Isolation infrastructure, conformité maximale.
- ➖ Coût exorbitant, ops impossible sans automation.
- **Rejeté** sauf cas Enterprise spécifique (offre potentielle V3).

## Conséquences

### Positives

- Isolation prouvée par tests, pas seulement par convention.
- Code applicatif plus court (`prisma.tenantAware.parcelle.findMany()` sans `where: { tenantId }` à chaque appel).
- Erreurs claires en cas de tentative cross-tenant — facilite le debug.

### Négatives

- L'extension Prisma a un coût en ergonomie : `findUnique` interdit sur modèles tenant-scoped (utiliser `findFirst`).
- Les modèles à deux fields tenant (Intervention, PartnerLink) doivent être filtrés manuellement — tests dédiés à venir.
- `update`/`delete` unitaires sur modèles tenant-scoped exigent un `findFirst` préalable ou un passage par `updateMany`/`deleteMany` (Prisma exige une clé unique sur `where` pour update unitaire).

### Contraintes pour la suite

- Tout nouveau modèle tenant-scoped doit être ajouté à `TENANT_SCOPED_MODELS` dans `tenant.middleware.ts` ET avoir un test d'isolation.
- Tout endpoint qui touche `Intervention` ou `PartnerLink` doit avoir un test e2e prouvant l'isolation (cas owner + cas author).
- Toute introduction de `$queryRawUnsafe` doit être justifiée dans le PR et n'autoriser que des paramétrages prouvablement safe.

## Suivi

- À surveiller : performance impact de l'extension à grande échelle (mesurer en V2 avec `pg_stat_statements`).
- À considérer en V2 : ajout de RLS Postgres comme couche 4.
- Le pattern `prisma.tenantAware.X` doit faire l'objet d'une mention explicite dans le `CONTRIBUTING.md` (section Prisma) — TODO étape 5+.
