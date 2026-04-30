# Backlog "Production Ready" — Agri Qodo

Audit réalisé le 2026-04-30 sur la branche `main` après PR #88. Liste exhaustive de **ce qui manque** pour passer d'un MVP testable à une **app SaaS déployable à toute la Suisse** (compliance RGPD/nFADP, multi-langue, mailing, support…).

Niveaux de priorité :

- 🔴 **Bloquant prod** — sans ça pas de signup public sécurisé
- 🟠 **Critique court terme** — à faire dans les 30j post-lancement
- 🟡 **Important** — qualité de service / différenciation
- 🟢 **Nice to have** — features secondaires

---

## 1. Authentification & sécurité 🔴

### 1.1 Reset mot de passe par e-mail 🔴

**Manque** : la page `/forgot-password` est juste un placeholder qui dit "contacte ton OWNER". Aucun flux automatisé.
**À faire** :

- Endpoint `POST /api/auth/password-reset/request` (email → génère token + envoie mail)
- Endpoint `POST /api/auth/password-reset/confirm` (token + nouveau pwd)
- Table `PasswordResetToken { id, userId, tokenHash, expiresAt, usedAt }`
- Template d'email "Réinitialise ton mot de passe" avec lien signé
- Rate limit (max 3 demandes / heure / email)

### 1.2 Vérification e-mail au signup 🔴

**Manque** : un user qui signup peut entrer n'importe quel email — pas de vérification.
**À faire** :

- Champ `User.emailVerifiedAt`
- Token de vérification envoyé au signup
- Endpoint de confirmation
- Lock partiel (ex : pas de push Odoo) tant que non vérifié

### 1.3 2FA (TOTP) 🟠

**Manque** : pas de second facteur. Critique pour OWNER qui contrôle l'exploitation.
**À faire** :

- Lib `otplib` ou similaire
- QR code pour app Authenticator
- Codes de récupération
- Toggle dans /parametres/securite

### 1.4 Politique de mot de passe 🟠

**Manque** : actuellement `123456789` accepté. Pas de check force.
**À faire** :

- Min 10 caractères + complexité (lib `zxcvbn`)
- Vérif contre top 1000 worst passwords
- Bloquer = email/prenom/nom

### 1.5 Détection brute-force / comptes compromis 🟠

**Manque** : login illimité, pas de captcha, pas de blocage IP.
**À faire** :

- Rate limit `@nestjs/throttler` sur /auth/login
- Lockout temporaire après N tentatives ratées
- Notif email "Connexion depuis un nouvel appareil" (geo IP)
- Page `/parametres/sessions` listant les sessions actives

### 1.6 Sessions & révocation 🟡

**Manque** : un user ne peut pas voir/révoquer ses sessions (impossible de "se déconnecter de partout sauf cet appareil").
**À faire** :

- Liste des refresh tokens actifs
- UI pour "Se déconnecter de cet appareil" / "Tous sauf celui-ci"

### 1.7 Audit logs 🟠

**Manque** : aucune trace des actions sensibles (login, logout, change pwd, suppression de données, push Odoo). Bloquant pour audit RGPD.
**À faire** :

- Table `AuditLog { id, tenantId, userId, action, target, ip, userAgent, payload, createdAt }`
- Interceptor NestJS qui log les actions sensibles
- Page `/parametres/journal` (admin) avec filtre date/user/action
- Rétention : 12 mois minimum (LPD/nFADP)

---

## 2. Mailing 🔴

### 2.1 Système d'envoi d'e-mails 🔴

**Manque** : **rien**. Aucun mail n'est envoyé. Pas de provider configuré.
**À faire** :

- Choisir provider : **Resend** (simple, dev-friendly) ou **Mailgun EU** (Suisse-friendly)
- Module `MailerModule` (NestJS) avec templates React Email ou MJML
- Variables ENV : `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`
- Templates : welcome, reset password, verify email, invitation partenaire, intervention pending, sale.order confirmé
- Job queue (BullMQ — déjà dispo) pour l'envoi async + retry

### 2.2 Notifications transactionnelles 🟠

**À faire** :

- Mail "Nouvelle intervention à valider" → owner du tenant client (cas B)
- Mail "Ton intervention a été acceptée/refusée" → prestataire (cas B)
- Mail "Devis Odoo créé" → owner avec lien direct
- Mail "Présence ouverte > 12h" → reminder pointage sortie

### 2.3 Newsletter / digest hebdo 🟢

**À faire** : digest mensuel des activités (X interventions / Y prestations / Z heures), bilans, alertes saisonnières.

---

## 3. Conformité RGPD / nFADP 🔴

La Suisse a sa propre loi (nFADP en vigueur depuis 2023-09-01) très proche du RGPD UE.

### 3.1 Pages légales 🔴

**Manque** : aucune page CGU, mentions légales, politique de confidentialité.
**À faire** :

- `/cgu` Conditions générales d'utilisation
- `/politique-confidentialite` (registre traitement, finalités, durées)
- `/mentions-legales` (raison sociale Kodo Digital SA, RC, TVA)
- `/cookies` + bandeau cookie compliant
- Lien footer global obligatoire sur toutes les pages

### 3.2 Consentement explicite 🔴

**À faire** :

- Checkbox "J'accepte les CGU + politique de confidentialité" sur signup (obligatoire)
- Stockage `User.cguAcceptedAt` + version des CGU acceptées
- Re-prompt si nouvelle version

### 3.3 Droit à l'export (portabilité) 🟠

**À faire** :

- Endpoint `GET /api/users/me/export` → ZIP avec toutes les données du user (parcelles, interventions, travaux, présences) en JSON + GeoJSON
- Bouton "Télécharger mes données" dans /parametres/mot-de-passe ou /parametres/donnees

### 3.4 Droit à l'effacement 🟠

**À faire** :

- Endpoint `DELETE /api/users/me` avec confirmation
- Anonymisation cascade ou suppression hard selon impact métier
- Cooldown 30j (soft delete) pour récupération en cas d'erreur
- Email confirmation post-suppression

### 3.5 Bandeau cookies 🟠

**À faire** : bandeau conforme nFADP/RGPD avec choix granulaire (essentiel / analytique / marketing).

### 3.6 Sous-traitance (data processors) 🟠

**À faire** : registre des sous-traitants (Vercel, Infomaniak, Odoo SA, mail provider, Sentry…). Annexe au contrat.

### 3.7 DPO / contact RGPD 🟢

**À faire** : email `dpo@qodo.ch` ou similaire. Page de demande RGPD avec formulaire.

---

## 4. Internationalisation 🟠

### 4.1 i18n FR/DE/IT 🟠

**Manque** : tout est en français hardcodé. La Suisse a 4 langues officielles, marché DE crucial (60% des exploitants).
**À faire** :

- `next-intl` ou `next-i18next` côté Next.js
- Extraire tous les libellés UI dans `messages/{fr,de,it}.json`
- Traduction DE prioritaire (DE > IT > EN)
- Toggle langue dans le profil + détection auto navigateur

### 4.2 Formats locaux 🟢

- Date format : 30.04.2026 (CH) au lieu de 30/04/2026 — déjà partiellement fait via `toLocaleDateString("fr-CH")`
- Nombres : 1'234.56 (CH) format
- Devise : CHF avec `'` comme séparateur de milliers

---

## 5. Onboarding & support 🟠

### 5.1 Onboarding nouvel utilisateur 🟠

**Manque** : un nouveau client signup arrive sur une app vide sans guide.
**À faire** :

- Wizard post-signup : 1. Importe tes parcelles (GeoJSON / saisie manuelle / API cantonale ?), 2. Connecte Odoo (optionnel), 3. Invite tes employés
- Tour guidé interactif (lib `intro.js` ou custom)
- Tooltips sur les boutons clés

### 5.2 Aide contextuelle 🟠

**Manque** : aucune doc accessible depuis l'app.
**À faire** :

- Page `/aide` ou `/docs` avec FAQ + tutoriels vidéo
- Bouton "?" sur chaque page qui ouvre la section pertinente
- Link Email → `support@qodo.ch`

### 5.3 Chat / Ticket support 🟡

**À faire** : intégration Crisp / Intercom / Tawk pour chat live. Ou simple email avec tag `[Tenant: AQ-XX]`.

### 5.4 Page status 🟡

**À faire** : page publique `status.qodo.ch` (uptime, incidents, maintenance planifiée).

---

## 6. Monitoring & observabilité 🟠

### 6.1 Error tracking 🟠

**Manque** : les erreurs prod ne remontent nulle part (juste les logs Docker).
**À faire** :

- **Sentry** (free tier suffit) côté backend + frontend
- Capture des exceptions non gérées + traces utilisateur
- Source maps Next.js uploadées au build

### 6.2 Logs structurés 🟢 (déjà fait)

- Pino déjà en place côté backend ✓

### 6.3 Analytics produit 🟡

**À faire** :

- **Plausible** ou **PostHog** (RGPD-compliant, EU-hosted)
- Track : signups, interventions/jour, push Odoo, churn
- Pas de Google Analytics (problème SCC USA)

### 6.4 Métriques techniques 🟢

- OpenTelemetry déjà importé mais pas branché
- À configurer vers Grafana Cloud / SigNoz

### 6.5 Uptime monitoring 🟢

**À faire** : Better Uptime / UptimeRobot pings sur https://newagri.qodo.ch + api.

---

## 7. Tests 🟠

### 7.1 Tests unitaires backend 🟠

**Manque** : 1 seul fichier de test trouvé.
**À faire** :

- Coverage minimum 60% sur les services (auth, interventions, travaux, presences, odoo)
- Tests de régression pour chaque bugfix critique (ex le bug `text=uuid` aurait été attrapé)

### 7.2 Tests e2e 🟠

**À faire** :

- Playwright pour les parcours clés : signup → parcelle → intervention → push Odoo
- Tests smoke prod après chaque déploiement (`pnpm test:smoke`)

### 7.3 CI 🟢 (déjà fait)

- GitHub Actions lint + typecheck + test + build ✓

---

## 8. Backup & continuité 🟠

### 8.1 Backup DB automatisé 🟠

**Manque** : on a fait un backup manuel pré-PR. Pas automatique.
**À faire** :

- Cron `pg_dump` quotidien → Infomaniak Swiss Backup (déjà existant pour qodo-clock)
- Test de restore mensuel (procédure documentée)
- Snapshot Cloud Server activé ✓ (rétention 7j)

### 8.2 Plan de reprise (DRP) 🟢

**À faire** : document `docs/DRP.md` — RTO 4h, RPO 24h, procédures.

---

## 9. Multi-tenant & ACL 🟠

### 9.1 Roles fins 🟠

**Manque** : 4 roles (OWNER/EMPLOYE/COMPTABLE/CONSULTANT) mais permissions hardcodées.
**À faire** :

- Page `/parametres/permissions` avec matrice (déjà placeholder "Bientôt")
- Permissions par module : `parcelles.read`, `interventions.write`, `travaux.invoice`, …
- Override par user

### 9.2 Quotas par tenant 🟢

**À faire** : limite parcelles/users/interventions selon plan. Affichage usage.

### 9.3 Compte multi-tenant 🟠

**Manque** : un user = un tenant via `email + tenantId`. Pour un comptable qui gère 5 exploitations, il a 5 comptes/passwords.
**À faire** : modèle `Account` (login global) + `Membership[]` (par tenant) — déjà mentionné en backlog #46.

---

## 10. Facturation SaaS 🟠

### 10.1 Plans & subscription 🟠

**Manque** : tout est gratuit, pas de pricing.
**À faire** :

- 3 plans : Free (limité 5 ha), Pro (29 CHF/mois), Business (89 CHF/mois)
- **Stripe** subscription + Checkout (TWINT via Stripe Suisse)
- Module `BillingModule` qui track l'usage et bloque selon plan
- Page `/parametres/abonnement` avec invoice history

### 10.2 TVA suisse 🟠

**À faire** : facturation auto avec TVA 8.1% CH, IBAN, QR-bill suisse.

---

## 11. Imports & intégrations 🟡

### 11.1 Import GeoJSON cantonal 🟡

**Existant** : import GeoJSON manuel (PR #31).
**Manque** : connexion automatique aux APIs SIG cantonales (VS, VD, BE, ZH ont des APIs ouvertes).
**À faire** : connecteur par canton, sync hebdo.

### 11.2 BDTA / Identitas 🟡

**À faire** : sync animaux depuis l'API Identitas (login agriculteur).

### 11.3 Acorda / SwissAgri / Centra 🟢

**À faire** : import des comptabilités existantes pour faciliter la migration.

### 11.4 Météo / climat 🟢

**À faire** : intégration MeteoSwiss / OpenWeather pour pré-remplir les conditions météo des interventions.

---

## 12. Mobile 🟡

### 12.1 App native Expo 🟡

**Existant** : `apps/mobile` skeleton.
**Manque** : tout. Connexion API, écrans, sync offline.
**À faire** :

- Login + refresh token persisté (SecureStore)
- Pages Présences (clock-in/out) + Interventions (saisie offline + sync)
- Build TestFlight / Play Store interne

### 12.2 PWA 🟢

**Manque** : Next.js sans manifest PWA.
**À faire** : ajouter `next-pwa` pour l'install Web mobile.

---

## 13. Performance & SEO 🟢

### 13.1 SEO landing 🟢

**À faire** : metadata, sitemap, robots.txt, Open Graph, Schema.org SaaS.

### 13.2 Performance 🟢

- Lighthouse audit
- Image optimization (Next.js Image déjà en place a priori)
- Code splitting automatique Next.js ✓

---

## 14. Documentation 🟡

### 14.1 Documentation utilisateur 🟡

**À faire** : `docs.qodo.ch` (Mintlify / Docusaurus / Notion public).

### 14.2 Changelog public 🟢

**À faire** : page `/changelog` qui publie les nouveautés.

### 14.3 API publique 🟢

**À faire** : Swagger déjà généré (`/docs`) — à passer en accès protégé + clé API par tenant.

---

## 15. Marketing & acquisition 🟢

- Page d'accueil publique soignée (existe partiellement à `/`)
- Blog / SEO content
- Signup form Plausible-tracked
- Landing pages par persona (laitier / grandes cultures / arboriculteur)
- Programme partenaires (fiduciaires, conseillers Agridea)

---

## Priorisation suggérée — premiers 3 mois

### Mois 1 (sécurité + RGPD)

1. Reset password par email 🔴
2. Vérification email signup 🔴
3. Pages légales CGU/RGPD/Cookies 🔴
4. Mail provider + welcome mail 🔴
5. Audit logs 🟠
6. Sentry 🟠

### Mois 2 (qualité + i18n)

7. i18n DE 🟠 (marché 60%)
8. 2FA optionnel 🟠
9. Tests e2e parcours critiques 🟠
10. Onboarding wizard 🟠
11. Backup auto + monitoring uptime 🟠

### Mois 3 (monétisation + mobile)

12. Stripe subscription + plans 🟠
13. App mobile Expo MVP (login + présences) 🟡
14. Page support + FAQ 🟡
15. Audit sécurité externe (avant launch public)

---

## Estimation grossière effort total

- 🔴 Bloquants prod : **3-4 semaines** dev
- 🟠 Critiques : **8-10 semaines**
- 🟡 Importants : **6-8 semaines**
- 🟢 Nice to have : à faire au fil de l'eau

→ **~6 mois** d'un dev solo pour un SaaS vraiment "déployable Suisse entière".
