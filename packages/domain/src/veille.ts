/**
 * Veille réglementaire (M15) — bibliothèque OPD/OPPh + glossaire métier.
 *
 * Phase MVP : contenu statique versionné dans le code, accessible offline
 * (utile pour l'app mobile). Quand le besoin d'éditorialisation arrivera
 * (panneau admin, syndication Agridea), on migrera vers une table Prisma.
 *
 * Catégories alignées sur les sources officielles :
 *  - OPD : Ordonnance fédérale sur les paiements directs
 *  - OPPh : Ordonnance sur les produits phytosanitaires
 *  - Lex : autres ordonnances/lois pertinentes
 *  - Guide : documents Agridea / OFAG
 *  - Glossaire : définitions de termes métier
 *  - Calendrier : échéances et dates clés
 */

export type VeilleCategorie = "OPD" | "OPPh" | "Lex" | "Guide" | "Glossaire" | "Calendrier";

export interface VeilleArticle {
  slug: string;
  titre: string;
  categorie: VeilleCategorie;
  /** Résumé "français paysan" — 2-3 phrases lisibles. */
  resume: string;
  /** Contenu en markdown léger (titres ##, listes, liens). */
  contenu: string;
  /** Lien vers la source officielle (admin.ch, Agridea). */
  sourceUrl?: string;
  sourceNom?: string;
  /** Date ISO (YYYY-MM-DD) de dernière mise à jour de l'article. */
  dateMaj: string;
  /** Tags libres pour la recherche. */
  tags: string[];
}

export const VEILLE_ARTICLES: VeilleArticle[] = [
  {
    slug: "opd-2026-vue-densemble",
    titre: "OPD 2026 — vue d'ensemble pour PER",
    categorie: "OPD",
    resume:
      "L'Ordonnance fédérale sur les paiements directs 2026 conditionne l'accès aux contributions PER. Conditions de base : assolement régulier, couverture du sol, bilan de fumure équilibré, surfaces de promotion biodiversité (SPB) ≥ 7 % SAU.",
    contenu: `## Conditions PER de base (Annexe 1 OPD)

Pour bénéficier des paiements directs, l'exploitation doit respecter :

- **Assolement régulier** — pas de monoculture deux années consécutives, ≥ 4 espèces sur 5 campagnes.
- **Couverture du sol** — du 15 nov. au 15 fév., chaque parcelle doit être couverte (culture, prairie, intercalaire, résidus).
- **Bilan de fumure équilibré** — selon Suisse-Bilanz (Guide Agridea 1.18). Tolérance 10 %.
- **SPB ≥ 7 %** — surfaces de promotion biodiversité sur la SAU.
- **Protection du sol** — mesures contre l'érosion sur parcelles à risque.

## Échéances 2026

- **31 janvier** : annonce des surfaces SPB
- **31 mars** : attestation des données
- **31 août** : déclaration finale du carnet des champs
`,
    sourceUrl: "https://www.fedlex.admin.ch/eli/cc/2013/765/fr",
    sourceNom: "RS 910.13 — fedlex.admin.ch",
    dateMaj: "2026-01-15",
    tags: ["PER", "paiements directs", "assolement", "SPB", "Suisse-Bilanz"],
  },
  {
    slug: "opph-delais-attente",
    titre: "OPPh — délais d'attente phytosanitaires",
    categorie: "OPPh",
    resume:
      "Le délai d'attente est le nombre de jours entre l'application d'un produit phytosanitaire et la récolte ou le pâturage. Il est fixé par l'autorisation OFAG et figure sur l'étiquette du produit.",
    contenu: `## Pourquoi des délais d'attente ?

Les résidus de phyto doivent décroître sous le seuil légal avant la consommation des denrées (humaines ou animales). Le délai dépend de la matière active, de la dose et de la culture cible.

## Comment Agri Qodo t'alerte

- À la saisie d'une **fumure phyto** dans le carnet, le délai est lu depuis le catalogue OFAG.
- La date "récolte autorisée" s'affiche immédiatement.
- Tu reçois une **alerte si tu saisis une récolte avant la fin du délai** sur la même parcelle.

## Sources officielles

- Catalogue OFAG des produits homologués (CSV mensuel)
- Étiquette du produit (autoritaire en cas d'écart)
`,
    sourceUrl: "https://www.psm.admin.ch/fr/produkte",
    sourceNom: "Catalogue OFAG des produits phytosanitaires",
    dateMaj: "2026-04-01",
    tags: ["phyto", "délai d'attente", "récolte", "résidus"],
  },
  {
    slug: "calendrier-per-2026",
    titre: "Calendrier réglementaire PER 2026",
    categorie: "Calendrier",
    resume:
      "Récapitulatif des dates clés pour rester conforme aux paiements directs et au plan de fumure. Vérifie ton canton pour les dates locales.",
    contenu: `## Échéances fédérales 2026

| Date | Échéance |
|------|----------|
| **15 nov. 2025 → 15 fév. 2026** | Sol couvert obligatoire (PER) |
| **15 nov. 2025 → 15 fév. 2026** | Interdiction de fumure organique sur sol nu/gelé/saturé |
| **31 janv. 2026** | Annonce SPB au canton |
| **31 mars 2026** | Attestation des données |
| **15 mai 2026** | Date limite semis maïs PER (selon canton) |
| **15 juil. 2026** | Date de fauche prairie extensive (selon altitude) |
| **31 août 2026** | Déclaration finale carnet des champs |
| **30 sept. 2026** | Plafond fumure organique PER |

## À surveiller côté canton

- VD/GE : portails Acorda — préavis 15 jours sur certains traitements zone S
- BE/FR/SO : GELAN — déclaration assolement avant 31 mars
- VS/TI : règles spécifiques zone d'altitude
`,
    dateMaj: "2026-01-10",
    tags: ["calendrier", "échéances", "PER", "fumure", "SPB"],
  },
  {
    slug: "glossaire-essentiels",
    titre: "Glossaire — termes essentiels PER",
    categorie: "Glossaire",
    resume:
      "Définitions courtes des termes officiels que tu rencontres dans le carnet, le Suisse-Bilanz et les déclarations cantonales.",
    contenu: `## Définitions

**PER** — Prestations Écologiques Requises. Conditions de base pour toucher les paiements directs.

**SAU** — Surface Agricole Utile. Toutes les surfaces productives de l'exploitation (cultures, prairies, vergers).

**SPB** — Surface de Promotion de la Biodiversité. Au moins 7 % de la SAU.

**UGB** — Unité Gros Bétail. Coefficient officiel par catégorie d'animal (vache laitière = 1.0, génisse = 0.6, veau = 0.13…). Cf Annexe 1 OPD.

**Suisse-Bilanz** — Bilan azote/phosphore de l'exploitation. Calculé selon Guide Agridea 1.18. Doit être équilibré (tolérance 10 %).

**BDTA** — Banque de Données sur le Trafic des Animaux. Gérée par Identitas SA. Source officielle des bovins suisses.

**Assolement régulier** — Rotation des cultures sur une parcelle. Min 4 espèces sur 5 ans, pas de monoculture 2 ans de suite.

**Délai d'attente** — Jours obligatoires entre application phyto et récolte. Fixé par l'OFAG dans le catalogue OPPh.

**Couverture du sol** — Obligation de garder une parcelle couverte du 15 nov. au 15 fév. (culture, intercalaire, résidus).

**Agate** — Identifiant fédéral pour s'authentifier auprès de la BDTA et des portails cantonaux (CH-Login).
`,
    dateMaj: "2026-04-29",
    tags: ["glossaire", "définitions", "PER", "UGB", "BDTA"],
  },
  {
    slug: "fumure-organique-interdictions",
    titre: "Fumure organique — périodes d'interdiction",
    categorie: "OPD",
    resume:
      "Pas de lisier, fumier ou compost entre le 15 novembre et le 15 février sur sol non couvert, gelé ou saturé d'eau. Pertes NH3 limitées par la technique d'épandage.",
    contenu: `## Règle générale (OPD Annexe 2.6)

Du **15 novembre au 15 février**, il est interdit d'appliquer de la fumure organique sur un sol :

- non couvert,
- gelé,
- saturé d'eau,
- enneigé.

## Techniques d'épandage et pertes NH3

| Technique | Pertes NH3 | Notes |
|-----------|-----------|-------|
| Épandeur classique | ~30 % | Déconseillé pour lisier |
| Rampe à pendillards | ~15 % | Standard moderne |
| Sabots / traînée souple | ~10 % | Sous couvert végétal |
| Injection directe | ~5 % | Optimal mais coûteux |
| Fumier solide | ~25 % | Incorporation < 4h recommandée |

Agri Qodo applique automatiquement ces coefficients dans le calcul Suisse-Bilanz selon la technique saisie sur l'intervention de fumure.

## Calendrier d'interdiction par canton

Certains cantons (VD, BE) durcissent les périodes selon altitude et zone S de captage. Vérifier sur le portail cantonal.
`,
    sourceUrl: "https://www.fedlex.admin.ch/eli/cc/2013/765/fr",
    sourceNom: "OPD Annexe 2.6 — fedlex.admin.ch",
    dateMaj: "2026-03-20",
    tags: ["fumure", "lisier", "fumier", "NH3", "interdiction", "pertes"],
  },
  {
    slug: "srpa-sst-bases",
    titre: "SRPA et SST — bases des contributions au bien-être animal",
    categorie: "OPD",
    resume:
      "SRPA = Sorties Régulières au Plein Air, SST = Systèmes de Stabulation Tranquille. Deux programmes optionnels qui rapportent des paiements directs supplémentaires si on enregistre les sorties au quotidien.",
    contenu: `## SRPA — Sorties Régulières au Plein Air

Engagement à laisser sortir les animaux au pâturage ou en parcours d'exercice :

- **Été (mai-oct.)** : 26 jours/mois min. en pâturage
- **Hiver (nov.-avril)** : 13 jours/mois min. en aire d'exercice ou pâturage

## SST — Systèmes de Stabulation Tranquille

Aire de repos garnie de litière + accès libre à un parcours.

## Comment Agri Qodo t'aide

- Saisie en **5 secondes** par catégorie (vache laitière, génisse…) avec géo-tag automatique optionnel.
- **Compteur mensuel** par catégorie : vert si ≥ seuil, rouge sinon.
- **Alerte** si tu n'as pas saisi de sortie depuis X jours sur une catégorie qui en nécessite.
- **Registre annuel** exportable PDF pour le contrôle PER.

## Contributions (référence 2026)

- SRPA bovins lait : ~290 CHF/UGB/an
- SST bovins : ~90 CHF/UGB/an
`,
    sourceUrl: "https://www.fedlex.admin.ch/eli/cc/2013/765/fr",
    sourceNom: "OPD chap. 6 — bien-être animal",
    dateMaj: "2026-02-15",
    tags: ["SRPA", "SST", "bien-être animal", "pâturage", "bovins"],
  },
];

export interface SearchOptions {
  categorie?: VeilleCategorie;
  query?: string;
}

/**
 * Recherche full-text simple (titre + résumé + tags + contenu) avec
 * filtre catégorie optionnel. Pas d'index, suffisant pour ~100 articles.
 */
export function searchVeille(
  articles: readonly VeilleArticle[] = VEILLE_ARTICLES,
  options: SearchOptions = {},
): VeilleArticle[] {
  const q = options.query?.toLowerCase().trim() ?? "";
  return articles.filter((a) => {
    if (options.categorie && a.categorie !== options.categorie) return false;
    if (!q) return true;
    return (
      a.titre.toLowerCase().includes(q) ||
      a.resume.toLowerCase().includes(q) ||
      a.contenu.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function getVeilleArticle(slug: string): VeilleArticle | undefined {
  return VEILLE_ARTICLES.find((a) => a.slug === slug);
}

export function listVeilleCategories(): Array<{ categorie: VeilleCategorie; count: number }> {
  const counts = new Map<VeilleCategorie, number>();
  for (const a of VEILLE_ARTICLES) {
    counts.set(a.categorie, (counts.get(a.categorie) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([categorie, count]) => ({ categorie, count }));
}
