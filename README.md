# NewagriQodo

> Application web open-source de gestion d'exploitation agricole, conçue pour les exploitants suisses. Parcellaire, carnet des champs, plan de fumure OEngrais 2024, multi-exploitations. Mobile-first, intégrable à Odoo.

[![Licence : AGPL v3](https://img.shields.io/badge/Licence-AGPL_v3-1f7a4d.svg)](LICENSE)
[![Hébergement : Suisse](https://img.shields.io/badge/H%C3%A9bergement-Suisse_(Infomaniak)-cc0000.svg)](https://www.infomaniak.com)
[![Stack : React + Supabase](https://img.shields.io/badge/Stack-React_19_%2B_Supabase-1f7a4d.svg)](#stack-technique)

**Démo en ligne** → [newagri.qodo.ch](https://newagri.qodo.ch) (bouton « Essayer la démo », pas d'inscription requise)

## Pourquoi open source ?

NewagriQodo est édité par [Qodo Digital](https://qodo.ch) (Moudon, VD), mais le code est libre sous **AGPL v3**. Concrètement :

- **N'importe quel exploitant ou coopérative** peut héberger sa propre instance.
- **N'importe quel développeur** peut contribuer, forker, auditer.
- **Toute modification** doit être publiée (clause AGPL : s'applique même au SaaS).
- **Vos données** restent chez vous : aucun lock-in, exports CSV/Excel/GeoJSON natifs.

Cette transparence est essentielle pour un outil qui touche aux contrôles cantonaux, à la fumure et à la traçabilité phytosanitaire.

## Stack technique

| Couche | Technologie |
|---|---|
| Front | React 19, TypeScript 6 strict, Vite, Tailwind v4, React Router v7, Leaflet |
| Tests | Vitest (71 tests) |
| Backend | Supabase auto-hébergé (Postgres 15 + GoTrue + PostgREST + Storage + Kong) |
| Reverse proxy | Caddy (TLS auto Let's Encrypt) |
| Email | Resend (SMTP transactionnel) |
| Hébergement | VPS Infomaniak (Plan-les-Ouates, Suisse strict — conforme LPD/RGPD) |
| Front prod | Vercel (CDN edge global) |

## Démarrage rapide

```bash
git clone https://github.com/Qodo-Digital/agri-qodo.git
cd agri-qodo/app
npm install
npm run dev         # http://localhost:5173 (mode démo immédiat avec données mock Darval)
npm test            # 71 tests Vitest
npm run typecheck   # tsc strict
npm run lint        # ESLint
```

Aucune config Supabase n'est requise pour le **mode démo** : l'app embarque 27 parcelles réelles du Domaine Darval (Échallens), 42 cultures Agridéa, ~80 interventions et l'équipe.

## Auto-héberger sa propre instance Supabase

Tout est documenté dans [`infra/supabase/README.md`](infra/supabase/README.md). En résumé :

```bash
# Sur un VPS Ubuntu 22.04+
sudo REPO_URL=https://github.com/<vous>/newagriqodo.git \
     bash <(curl -fsSL https://raw.githubusercontent.com/<vous>/newagriqodo/main/infra/supabase/scripts/bootstrap.sh)
```

Le script installe Docker, Caddy, UFW, fail2ban, génère tous les secrets, déploie la stack Supabase et active le backup quotidien. Compter ~20 min.

Côté front (Vite) :

```bash
# app/.env.local
VITE_SUPABASE_URL=https://supabase.votre-domaine.ch
VITE_SUPABASE_ANON_KEY=...  # affiché par bootstrap.sh
```

## Où chercher quoi

| Sujet | Lien |
|---|---|
| Contexte projet pour Claude Code | [`CLAUDE.md`](CLAUDE.md) |
| Politique de sécurité | [`SECURITY.md`](SECURITY.md) |
| Schéma SQL Supabase (RLS multi-tenant) | [`supabase/migrations/`](supabase/migrations/) |
| Stack infra auto-hébergée | [`infra/supabase/`](infra/supabase/) |
| Spec fonctionnelle | [`docs/2_Architecture/SPEC.md`](docs/2_Architecture/SPEC.md) |
| Roadmap | [`docs/1_Overview/ROADMAP.md`](docs/1_Overview/ROADMAP.md) |
| Composants réutilisables | [`docs/3_Features/COMPOSANTS_REUSABLES.md`](docs/3_Features/COMPOSANTS_REUSABLES.md) |
| Module RH | [`docs/3_Features/MODULE_RH.md`](docs/3_Features/MODULE_RH.md) |
| Agents Claude | [`docs/6_Agents/AGENTS.md`](docs/6_Agents/AGENTS.md) |
| Wireframes HTML | [`docs/8_Wireframes/`](docs/8_Wireframes/) |

## Structure du dépôt

```
newagriqodo/
├── app/                    Front React (Vite + Tailwind + Leaflet)
├── infra/supabase/         Stack Docker auto-hébergée + scripts
├── supabase/               Migrations SQL + seed catalogue cultures
├── website/                (legacy — site marketing Astro, fusionné dans app/)
├── docs/                   Documentation complète
├── .claude/                Hooks + agents Claude Code spécialisés
├── CLAUDE.md               Contexte pour Claude (auto-chargé)
├── SECURITY.md             Politique de sécurité, modèle de menaces
├── LICENSE                 AGPL v3
└── README.md               Vous êtes ici
```

## Sécurité

- **RLS Postgres** active sur toutes les tables farm-scope (isolation stricte entre exploitations)
- **Données en Suisse uniquement** (Plan-les-Ouates, Genève — Infomaniak)
- **Mode démo isolé** : les données mock Darval ne touchent jamais à Supabase
- **8 hooks Claude Code** bloquants (`block-secrets`, `block-service-key-front`, etc.) qui empêchent l'introduction de failles côté agent
- **Agents d'audit dédiés** : `security-auditor`, `rls-reviewer`, `secrets-scanner`

Signaler une vulnérabilité : `security@qodo.ch` (réponse < 72 h). Détails dans [`SECURITY.md`](SECURITY.md).

## Contribuer

Les PR sont bienvenues. Avant d'envoyer :

```bash
cd app
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

Respecter les conventions du projet (cf. `CLAUDE.md`) :
- Light only, pas de dark mode
- Pas d'emoji (ni dans le code, ni dans l'UI)
- Border-radius via variables CSS (`rounded-(--radius-*)`)
- Icônes SVG inline style Lucide
- Toutes les tables/listes doivent avoir multi-sélection + actions groupées

## Licence

**GNU Affero General Public License v3.0** — voir [`LICENSE`](LICENSE).

En résumé : vous pouvez utiliser, modifier, redistribuer le code librement. **Si vous l'utilisez pour proposer un service en ligne** (même sans le distribuer), vous devez publier vos modifications sous AGPL v3.

Édité par **Qodo Digital Sàrl** · Ch. des Halles 3, 1510 Moudon (VD), Suisse · [info@qodo.ch](mailto:info@qodo.ch)
