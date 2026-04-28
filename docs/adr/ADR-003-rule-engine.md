# ADR-003 — Moteur de règles configurables (Rule Engine)

- **Statut** : Accepté
- **Date** : 2026-04-28
- **Décideurs** : Fabien Cossy (porteur), Claude Code (assistant)
- **Lié** : SPEC §7 (modules), §12 (sécurité)

## Contexte

L'agriculture suisse est soumise à un cadre légal en évolution constante :

- Le **Guide Agridea Suisse-Bilanz** sort une nouvelle version par an (1.18, 1.19, …) avec des coefficients d'azote/phosphore par culture qui changent.
- L'**OPD** (Ordonnance sur les paiements directs) est révisée régulièrement (train d'ordonnances 2026, 2027…).
- Les **seuils SRPA** (jours de sortie minimum par catégorie d'animaux et saison) peuvent évoluer.
- Le **bio Suisse / Bourgeon** ajoute des règles plus strictes par-dessus l'OPD standard.
- Certains **cantons** appliquent des variantes locales.
- Chaque **exploitation** peut avoir des particularités (zone montagne, label spécifique, dérogation accordée).

Si chaque seuil/coefficient est codé en dur dans le code applicatif, chaque évolution réglementaire impose un déploiement, ce qui est lent, risqué et inadapté à un produit promettant le respect quotidien de la conformité.

## Décision

Toutes les **valeurs paramétriques métier** vivent dans un **moteur de règles configurable** par template et override, **pas en dur dans le code**.

### Modèle de données

```
RuleSet (id, name, scope, tenantId?, canton?, parentId?, isActive,
         effectiveFrom, effectiveTo)
   1..N
Rule (id, ruleSetId, key, valueJson, description)
```

`RuleSetScope` :

- **GLOBAL** — template universel (`OPD-CH-2026`, `OPD-CH-2026-BIO`)
- **CANTON** — variante cantonale (`OPD-VD-2026`)
- **TENANT** — override par exploitation (`Override Ferme Rolet`)

### Hiérarchie de résolution

Le `RuleEngineService.get(key, defaultValue)` parcourt dans l'ordre :

1. **RuleSet TENANT** actif du tenant courant — l'agriculteur a personnalisé ce point
2. **RuleSet CANTON** actif (V2) — variante cantonale officielle
3. **RuleSet GLOBAL** actif — template OPD-CH-2026 ou OPD-CH-2026-BIO selon le choix de l'exploitation
4. **`defaultValue`** — fallback hardcoded dernière chance

Le premier qui répond gagne. Si aucun n'a la clé, on retourne `defaultValue`.

### Conventions de nommage des clés

`<module>.<sous-clé>.<précision>` — séparateur point, snake_case :

```
assolement.nb_campagnes_diversite
assolement.min_especes_distinctes
assolement.prairie_prefixes
srpa.vache_laitiere.jours_min_ete
srpa.vache_laitiere.jours_min_hiver
tva.taux_travail_du_sol
tva.taux_standard
suisse_bilanz.coefficient_n.ble_panifiable
suisse_bilanz.coefficient_p.colza
ugb.facteur.vache_laitiere
spb.ratio_minimum
```

### Cache

`RuleEngineService` maintient un cache mémoire `(tenantId | "global", key) → value` avec TTL 5 minutes. Méthodes `invalidateAll()` et `invalidateTenant(id)` à appeler après écriture admin.

### Pureté du module domain

`packages/domain/` reste **sans aucune dépendance** à Prisma/NestJS. Les fonctions métier acceptent un objet de configuration en argument :

```typescript
// packages/domain/src/assolement.ts
export interface AssolementConfig {
  nbCampagnesDiversite: number;
  minEspecesDistinctes: number;
  prairiePrefixes: string[];
}
export const DEFAULT_ASSOLEMENT_CONFIG: AssolementConfig = { ... };

export function verifierAssolement(
  cultures: readonly CultureRecord[],
  config: AssolementConfig = DEFAULT_ASSOLEMENT_CONFIG,
): AssolementResult { ... }
```

Côté backend NestJS :

```typescript
// dans un service métier
const config = await this.ruleEngine.getMany<AssolementConfig>(DEFAULT_ASSOLEMENT_CONFIG);
const result = verifierAssolement(cultures, config);
```

Bénéfice : tests `packages/domain/` restent purs et offline-compatibles (utilisable sur mobile sans backend).

## Modules concernés

À mesure que les modules métier sont implémentés, **toutes leurs constantes paramétriques sont externalisées** :

| Module            | Clés (extraits)                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **Assolement**    | `assolement.nb_campagnes_diversite`, `min_especes_distinctes`, `prairie_prefixes`                |
| **SRPA**          | `srpa.<categorie>.jours_min_ete`, `jours_min_hiver`, `duree_min_minutes`                         |
| **Suisse-Bilanz** | `suisse_bilanz.coefficient_n.<culture>`, `coefficient_p.<culture>`, `apport_par_ugb.<categorie>` |
| **SPB**           | `spb.ratio_minimum`, `dates_fauche_autorisees`, `especes_eligibles`                              |
| **TVA**           | `tva.taux_travail_du_sol`, `taux_standard`, `exoneration_seuil_ca`                               |
| **UGB**           | `ugb.facteur.<categorie>`                                                                        |
| **Pilotage**      | `pilotage.marge_brute_reference.<culture>`                                                       |

## Templates seedés (initial)

- **`OPD-CH-2026`** (GLOBAL) — Template OPD Suisse standard 2026 (9 règles initiales, étendu progressivement).
- **`OPD-CH-2026-BIO`** (GLOBAL) — Variante bio Suisse / Bourgeon avec règles plus strictes.

À venir : `OPD-CH-2027`, `OPD-VD-2026`, `OPD-GE-2026`, etc.

## Alternatives considérées

### A. Constantes hardcoded (statu quo)

- ➕ Simple, fast.
- ➖ Toute évolution = redéploiement, downtime, friction. Inadapté à un produit qui touche à du légal.
- **Rejetée** dès l'apparition d'une 2ᵉ valeur configurable.

### B. Fichiers JSON versionnés dans le repo

- ➕ Simple, versionnage Git, review possible.
- ➖ Pas de personnalisation par tenant, redéploiement nécessaire pour chaque modification.
- **Rejetée** car ne supporte pas le besoin tenant-override.

### C. Service externe (LaunchDarkly, ConfigCat)

- ➕ Pas de dev custom, UI admin clé en main.
- ➖ Coût mensuel, dépendance externe pour des données métier critiques, pas adapté aux structures complexes (objets nested).
- **Rejetée** pour MVP. Ré-évaluable si UI admin devient un besoin majeur.

### D. Rule Engine custom (cette ADR)

- ➕ Maîtrise totale, intégré au modèle multi-tenant existant, structure libre (JSON).
- ➖ UI admin à construire.
- **Adoptée**.

## Conséquences

### Positives

- Adaptation aux évolutions OPD/Agridea **sans redéploiement** — il suffit d'éditer le template `OPD-CH-2026` ou de créer `OPD-CH-2027`.
- Variantes par canton, par label (bio), par exploitation **par construction**.
- Module domain reste pur et testable offline (mobile).
- Audit trail facile (un changement de règle est une ligne SQL traceable).

### Négatives

- Léger overhead par lookup (5 ms typique avec cache, 50 ms sans).
- Tentation d'externaliser TROP — limiter aux paramètres effectivement variables.
- UI admin à construire (V2) sinon les changements passent par un script ts-node.

### Contraintes

- **Toute nouvelle constante métier** introduite dans `packages/domain/` **doit** :
  1. Avoir un `DEFAULT_<NAME>_CONFIG` exporté
  2. Être ajoutée au seed `prisma/seed-rules.ts` dans `OPD-CH-2026`
  3. Être documentée dans la table « Modules concernés » de cette ADR
- Le module domain ne **doit jamais** importer `RuleEngineService` (pureté).
- Les tests `packages/domain/` utilisent les valeurs par défaut, pas le RuleEngine.
- Les tests e2e backend qui dépendent d'une règle peuvent seeder leur propre RuleSet.

## Évolutions prévues (V2+)

- **UI Configuration** : `/parametres/regles` (visualiser règles actives, override) + `/parametres/templates` (changer de template parent).
- **Variantes cantonales** : seed des templates `OPD-VD-2026`, `OPD-GE-2026` quand on a la matière.
- **Versioning historique** : conserver les anciens RuleSets (effectiveTo) pour rejouer un calcul historique avec les coefficients de l'époque (audit conformité).
- **Editeur de templates** Agridea-friendly : interface qu'un conseiller Agridea peut utiliser pour publier `OPD-CH-2027`.

## Suivi

- Mesurer le nombre de clés actives, la part hardcoded vs configurable.
- Décider du moment où une UI admin devient nécessaire (probablement après 30+ règles ou première demande client).
