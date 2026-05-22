# Déploiement Agri Qodo en production

Stack cible :

- **Frontend Next.js** → Vercel (gratuit, CDN mondial, HTTPS auto)
- **Backend NestJS + PostgreSQL/PostGIS** → VPS Infomaniak (souveraineté Suisse)
- **Reverse proxy HTTPS** → Caddy (Let's Encrypt automatique)
- **Domaine** : `agri.qodo.ch` (frontend) + `api.agri.qodo.ch` (backend)

Coût total : **~12 CHF/mois** (VPS) + 0 CHF (Vercel free tier).

---

## 1. Provisionner le VPS Infomaniak

1. https://www.infomaniak.com/fr/hebergement/cloud-computing/cloud-server
2. Choisir **Cloud Server S** : 1 vCPU / 2 Go RAM / 25 Go SSD = ~12 CHF/mois
3. OS : **Ubuntu 24.04 LTS**
4. Datacenter : **Genève** (souveraineté CH)
5. Renseigner ta clé SSH publique (génère via `ssh-keygen` si pas déjà fait)
6. Note l'IP publique du VPS (ex: `83.228.xxx.xxx`)

## 2. Configurer le DNS chez Infomaniak (manager qodo.ch)

Manager Infomaniak → Domaines → `qodo.ch` → DNS :

| Type  | Nom           | Valeur                     | TTL  |
| ----- | ------------- | -------------------------- | ---- |
| A     | `api.newagri` | IP du VPS (ex: 83.228.x.x) | 3600 |
| CNAME | `newagri`     | `cname.vercel-dns.com.`    | 3600 |

Propagation : généralement quelques minutes, max 24h.

## 3. Préparer le VPS

SSH dans le VPS :

```bash
ssh root@83.228.xxx.xxx   # ou ton user si tu n'es pas root
```

Installer Docker + Docker Compose :

```bash
curl -fsSL https://get.docker.com | sh
apt install -y git
systemctl enable --now docker
```

Cloner le repo :

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/fabiencossy/agri-qodo.git
cd agri-qodo
```

## 4. Configurer les secrets

Créer `.env.production` sur le VPS :

```bash
cp .env.production.example .env.production
nano .env.production
```

Remplir :

- `POSTGRES_PASSWORD` : `openssl rand -base64 32`
- `JWT_SECRET` : `openssl rand -hex 64`
- `JWT_REFRESH_SECRET` : `openssl rand -hex 64` (différent du JWT_SECRET)

Vérifier que `DOMAIN_API=api.agri.qodo.ch` est bien là.

## 5. Premier démarrage

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Vérifier que les 3 services tournent :

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Caddy obtient automatiquement le certificat HTTPS pour `api.agri.qodo.ch` au premier démarrage (peut prendre 1-2 min).

Tester :

```bash
curl https://api.agri.qodo.ch/health
# Doit renvoyer { "status": "ok", ... }
```

## 6. Seed initial (rules + produits + compte démo)

```bash
docker compose -f docker-compose.prod.yml exec backend sh -c "
  npx ts-node prisma/seed-rules.ts &&
  npx ts-node prisma/seed-produits.ts &&
  npx ts-node prisma/seed.ts
"
```

Le compte de démo `test@test.ch / test` est maintenant accessible.

## 7. Déployer le frontend sur Vercel

1. https://vercel.com → "Sign in with GitHub" (compte fabiencossy)
2. **Add new… → Project**
3. Sélectionner le repo `fabiencossy/agri-qodo`
4. **Configure project** :
   - Framework Preset : **Next.js** (auto-détecté)
   - Root Directory : `apps/web`
   - Build Command : laisser par défaut
   - Output Directory : laisser par défaut
5. **Environment Variables** :
   - `BACKEND_URL` = `https://api.agri.qodo.ch`
   - (laisser `NEXT_PUBLIC_API_URL` vide → fallback sur proxy `/api/*`)
6. **Deploy**

Premier deploy ~3 min. Vercel fournit une URL `agri-qodo-xxxx.vercel.app`.

## 8. Brancher le domaine `agri.qodo.ch`

Vercel → Project → **Settings → Domains** :

1. Ajouter `agri.qodo.ch`
2. Vercel vérifie que le CNAME pointe bien sur `cname.vercel-dns.com`
3. Certificat HTTPS automatique (Let's Encrypt via Vercel)

Quelques minutes plus tard : **https://agri.qodo.ch** est en ligne.

## 9. Tester la chaîne complète

1. Aller sur https://agri.qodo.ch
2. Login avec `test@test.ch` / `test`
3. Voir les 3 parcelles, le cheptel, le Suisse-Bilanz

## 10. Mises à jour ultérieures

Workflow recommandé :

1. Code sur ta machine, commit, push sur une branche.
2. PR vers main, merge.
3. **Frontend** : Vercel redeploy automatiquement à chaque push sur main.
4. **Backend** : SSH dans le VPS et :

```bash
cd /opt/agri-qodo
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build backend
```

(Le Dockerfile fait `prisma migrate deploy` au démarrage → migrations DB auto.)

## 11. Backups

Snapshot Infomaniak Cloud Server activé par défaut (rétention 7 jours, inclus).

Optionnel : backup PostgreSQL hebdomadaire manuel pour préservation longue durée :

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U agriqodo agriqodo | gzip > /opt/backups/agriqodo-$(date +%F).sql.gz
```

À automatiser via cron (`crontab -e`) :

```cron
0 3 * * 0 cd /opt/agri-qodo && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U agriqodo agriqodo | gzip > /opt/backups/agriqodo-$(date +\%F).sql.gz
```

## 12. Monitoring (optionnel V1)

À l'arrache pour la démo :

- Logs : `docker compose logs -f backend`
- Healthcheck : `curl https://api.agri.qodo.ch/health` depuis un cron externe (ex: UptimeRobot — gratuit jusqu'à 50 monitors)

V2 : intégrer Grafana + Loki + Prometheus dans le compose, ou plus simple : Better Stack (Logtail) gratuit jusqu'à 1 Go/mois.

## 13. Migration vers Kodo Digital SA

Quand l'organisation GitHub `kodo-digital-sa` (ou similaire) sera créée :

1. Repo Settings → bas de page → **Transfer ownership**
2. Choisir l'org cible
3. Confirmer

Côté VPS et Vercel : aucun changement (le repo conserve son URL `github.com/{org}/agri-qodo`, Vercel suit automatiquement, GitHub redirige les anciens liens). Le `git remote` côté VPS doit être mis à jour :

```bash
cd /opt/agri-qodo
git remote set-url origin git@github.com:kodo-digital-sa/agri-qodo.git
```

---

## Annexe : actions hors-VPS pour Fabien

À faire manuellement (je ne peux pas les exécuter à ta place) :

- [ ] Acheter Cloud Server S Infomaniak
- [ ] Configurer DNS qodo.ch (2 entrées)
- [ ] Créer compte Vercel + lier GitHub
- [ ] Renseigner les secrets dans `.env.production` sur le VPS
- [ ] Cliquer "Deploy" sur Vercel

Tout le reste (Dockerfile, Compose, Caddy, seed) est automatisé.
