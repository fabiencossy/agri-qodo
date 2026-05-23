# Contribuer à NewagriQodo

Merci de votre intérêt ! NewagriQodo est édité par [Qodo Digital](https://qodo.ch) mais le code est libre sous AGPL v3 : toutes les contributions sont bienvenues.

## Façons de contribuer

- **Signaler un bug** → [Ouvrir une issue](https://github.com/Qodo-Digital/agri-qodo/issues/new)
- **Proposer une fonctionnalité** → [Démarrer une discussion](https://github.com/Qodo-Digital/agri-qodo/discussions/new)
- **Améliorer le code** → fork + pull request (voir ci-dessous)
- **Améliorer la doc** → idem, modifier les `.md` dans `docs/`
- **Signaler une vulnérabilité** → email `security@qodo.ch` (NE PAS ouvrir d'issue publique, cf. [`SECURITY.md`](SECURITY.md))
- **Traduire** → l'app est française uniquement pour l'instant ; pour une version i18n, démarrer une discussion

## Démarrage développeur (5 min)

```bash
git clone https://github.com/Qodo-Digital/agri-qodo.git
cd agri-qodo/app
npm install
npm run dev         # http://localhost:5173 (mode démo avec données mock Darval)
```

Pas besoin de configurer Supabase : le **mode démo** embarque 27 parcelles réelles du Domaine Darval, 42 cultures Agridéa, ~80 interventions.

Pour tester l'authentification réelle, suivre [`infra/supabase/README.md`](infra/supabase/README.md).

## Avant d'envoyer une PR

```bash
cd app
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

Les 4 doivent passer. CI GitHub Actions vérifie automatiquement.

## Conventions du projet

Détaillées dans [`CLAUDE.md`](CLAUDE.md). En résumé :

### Visuel
- **Light only** — pas de dark mode (rajouté plus tard si demandé)
- **Pas d'emoji** dans le code ni dans l'UI
- **Border-radius via variables CSS** : `rounded-(--radius-sm|--radius|--radius-lg|--radius-pill)` (pas de `rounded-md` Tailwind direct)
- **Couleurs via variables CSS** : `text-(--color-text)`, `bg-(--color-primary)`, etc.
- **Icônes SVG inline style Lucide** : `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth={1.5..1.75}`
- **Touch targets** : 44px mobile, 36-40px desktop
- **Z-index** : tout overlay au-dessus de Leaflet doit être `z-[1000]+` (Leaflet utilise 400-700)

### Code
- **TypeScript strict** + `noUncheckedIndexedAccess` activé
- **Pas de `any`** sans justification (commentaire `// eslint-disable-next-line` + raison)
- **Pas de default export** sauf pour les Pages (composants en named export)
- **Tests Vitest** pour les composants (`Component.test.tsx` dans le même dossier)
- **Pas de mutations sur store** sans passer par les helpers du module

### Architecture
- **Dual-mode store** (cf. `app/src/modules/*/store.ts`) : mode démo n'appelle JAMAIS Supabase
- **RLS Postgres** active sur toutes les tables farm-scope (cf. `supabase/migrations/`)
- **Toutes les listes** doivent avoir multi-sélection + actions groupées (checkbox + barre d'actions)
- **Pages détail** : onglet "Aperçu" qui résume tout + onglets spécifiques

### Commits
- Messages en français acceptés
- Format conventionnel encouragé : `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Référencer issue si applicable : `fix: bordure timeline assolement (#42)`

## Anatomie d'une PR idéale

1. **Petit scope** : une fonctionnalité OU un fix, pas les deux
2. **Description** : pourquoi (pas juste quoi — git diff suffit pour le quoi)
3. **Screenshot avant/après** si changement visuel
4. **Tests ajoutés ou mis à jour** si comportement modifié
5. **Doc à jour** si convention/architecture impactée

## Process de review

- Les PRs sont reviewées par Fabien Cossy (Qodo Digital)
- Délai moyen : 3-5 jours
- Suggestions = bienvenues, débat ouvert
- Les PRs vraiment importantes peuvent déclencher une visio rapide (15 min)

## Reconnaissance des contributions

Tous les contributeurs apparaissent dans l'historique git et sur la page contributeurs GitHub. Pour les contributions substantielles, ajout au fichier `AUTHORS.md` (à créer dès la première contribution externe).

## Code of Conduct

Ce projet adhère au [Contributor Covenant](CODE_OF_CONDUCT.md). En contribuant, vous acceptez de respecter ces règles.

## Questions ?

- Discussion ouverte : https://github.com/Qodo-Digital/agri-qodo/discussions
- Email : info@qodo.ch
