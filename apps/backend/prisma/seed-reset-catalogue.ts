/**
 * Reset complet du catalogue Produits + Matériels (demande Fabien
 * 2026-05-06 : "supprime tous les produits et recrée une base
 * complète avec tous les travaux possibles ainsi que tous les
 * produits possibles pour l'agriculture").
 *
 * 1) DELETE Produit + Matériel (globaux + perso, tous tenants).
 *    Les Interventions/Travaux qui les référençaient gardent leur
 *    libellé/quantité/prix (snapshot dans LigneTravailProduit) — les
 *    relations sont en onDelete: SetNull.
 * 2) Re-run seed-materiels (33 prestations Agridea) +
 *    seed-produits (176 produits : semences, engrais, phytos…).
 * 3) Ajoute des prestations et produits supplémentaires pour couvrir
 *    le maximum d'opérations agricoles courantes en Suisse.
 *
 * Idempotent : on peut le rejouer, les upserts gèrent.
 *
 * Lancement : `pnpm db:seed:reset-catalogue` (à ajouter au package.json
 * une fois validé).
 */
import { execSync } from "node:child_process";
import {
  MaterielCategorie,
  MaterielUnite,
  PrismaClient,
  ProduitCategorie,
  ProduitUnite,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Matériels supplémentaires (prestations) ──────────────────────────
// Complète seed-materiels.ts avec des opérations courantes manquantes.
interface SeedMateriel {
  code: string;
  libelle: string;
  categorie: MaterielCategorie;
  unite: MaterielUnite;
  prixUnitaireCHF: number | null;
  notes?: string;
}

const MATERIELS_EXTRA: SeedMateriel[] = [
  // Travail du sol — compléments
  {
    code: "MAT-TRAV-COVER-CROP",
    libelle: "Cover crop (déchaumeur à disques)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 90,
    notes: "Disques indépendants, ~10-15 cm, gestion résidus + adventices.",
  },
  {
    code: "MAT-TRAV-CULT-DENTS",
    libelle: "Cultivateur à dents (chisel)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 100,
    notes: "Travail superficiel 8-15 cm sans retourner.",
  },
  {
    code: "MAT-TRAV-ROUL-LISSE",
    libelle: "Roulage (rouleau lisse)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 35,
    notes: "Rouleau Cambridge ou lisse — rappuyage post-semis.",
  },
  {
    code: "MAT-TRAV-ROUL-CROSSKILL",
    libelle: "Roulage (Crosskill)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 40,
  },
  {
    code: "MAT-TRAV-SOUS-SOL",
    libelle: "Sous-solage (décompacteur lourd)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 165,
    notes: "Travail profond 35-45 cm sans retourner.",
  },
  // Semis & plantation — compléments
  {
    code: "MAT-SEM-PNEUM",
    libelle: "Semis céréales (semoir pneumatique)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 145,
    notes: "Semoir pneumatique précision, idéal grandes parcelles.",
  },
  {
    code: "MAT-SEM-COMBINE",
    libelle: "Semis combiné (herse + semoir)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 175,
    notes: "Préparation lit + semis en un passage.",
  },
  {
    code: "MAT-SEM-COLZA",
    libelle: "Semis colza (semoir précision)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 155,
  },
  {
    code: "MAT-SEM-BETT",
    libelle: "Semis betteraves sucrières (semoir mono-graine)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 160,
  },
  {
    code: "MAT-SEM-PRAIRIE",
    libelle: "Semis prairie (semoir herbe)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 110,
  },
  {
    code: "MAT-SEM-DEROBEE",
    libelle: "Semis dérobée fourragère",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 95,
    notes: "Semis après moisson — interculture / engrais vert.",
  },
  // Fertilisation — compléments
  {
    code: "MAT-FERT-COMPOST",
    libelle: "Épandage compost",
    categorie: "FERTILISATION",
    unite: "T",
    prixUnitaireCHF: 12,
    notes: "Compost végétal ou de fumier — épandeur classique.",
  },
  {
    code: "MAT-FERT-LISIER-INJ",
    libelle: "Épandage lisier (injection)",
    categorie: "FERTILISATION",
    unite: "M3",
    prixUnitaireCHF: 19,
    notes: "Injection sous-sol — perte NH3 ~5% (cf Agridea 1.18).",
  },
  {
    code: "MAT-FERT-CHAULAGE",
    libelle: "Chaulage (épandeur centrifuge)",
    categorie: "FERTILISATION",
    unite: "T",
    prixUnitaireCHF: 18,
    notes: "Chaux vive ou carbonate — correction pH.",
  },
  // Protection — compléments
  {
    code: "MAT-PROT-DESHERB-MEC",
    libelle: "Désherbage mécanique (bineuse)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 75,
    notes: "Bineuse à dents ou à disques — Bio / IP-Suisse.",
  },
  {
    code: "MAT-PROT-HERSE-ETRILLE",
    libelle: "Herse étrille (post-levée)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 45,
  },
  {
    code: "MAT-PROT-PULV-CONFINE",
    libelle: "Pulvérisation confinée (anti-dérive)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 70,
    notes: "Buses anti-dérive 50% — exigé près des eaux de surface.",
  },
  // Récolte — compléments
  {
    code: "MAT-REC-ENS-MAIS",
    libelle: "Ensilage maïs (ensileuse automotrice)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 420,
    notes: "Ensileuse 6 rangs + transport bord de champ inclus.",
  },
  {
    code: "MAT-REC-ENS-HERBE",
    libelle: "Ensilage herbe (ensileuse)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 290,
  },
  {
    code: "MAT-REC-PRESS-CARRE",
    libelle: "Pressage balles carrées",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 180,
  },
  {
    code: "MAT-REC-MAIS-GRAIN",
    libelle: "Récolte maïs grain (moissonneuse + bec)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 410,
  },
  {
    code: "MAT-REC-BROYAGE",
    libelle: "Broyage de cultures (couvert / résidus)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 110,
  },
  // Irrigation — compléments
  {
    code: "MAT-IRR-PIVOT",
    libelle: "Irrigation pivot (rampe rotative)",
    categorie: "IRRIGATION",
    unite: "HA",
    prixUnitaireCHF: 65,
  },
  {
    code: "MAT-IRR-GOUTTE",
    libelle: "Irrigation goutte-à-goutte (pose système)",
    categorie: "IRRIGATION",
    unite: "HA",
    prixUnitaireCHF: 950,
    notes: "Pose initiale — réutilisable plusieurs années.",
  },
  // Transport — compléments
  {
    code: "MAT-TRANS-BENNE",
    libelle: "Transport benne 12-16 t (tracteur + remorque)",
    categorie: "TRANSPORT",
    unite: "H",
    prixUnitaireCHF: 95,
  },
  {
    code: "MAT-TRANS-ANIM",
    libelle: "Transport bétail (camion bétaillère)",
    categorie: "TRANSPORT",
    unite: "H",
    prixUnitaireCHF: 130,
  },
  // Autre — compléments
  {
    code: "MAT-AUT-CONSEIL",
    libelle: "Conseil agronomique (Agridea / privé)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 150,
  },
  {
    code: "MAT-AUT-MAINT",
    libelle: "Maintenance / atelier",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 95,
  },
  // ─── BOTTELAGE / PRESSAGE (manquant) ─────────────────────────────────
  {
    code: "MAT-REC-BOTT-RONDE-SEC",
    libelle: "Bottelage balles rondes (foin/paille sec)",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 16,
    notes: "Tarif Agridea par balle ronde 1.20-1.50m, foin/paille sec.",
  },
  {
    code: "MAT-REC-BOTT-RONDE-SILO",
    libelle: "Bottelage balles rondes (silo / enrubanné)",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 32,
    notes: "Tarif par balle, ensilage humide, film inclus si combiné.",
  },
  {
    code: "MAT-REC-BOTT-COMBINEE",
    libelle: "Botteleuse-enrubanneuse combinée",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 38,
    notes: "Une seule machine — pressage + enrubannage en continu.",
  },
  {
    code: "MAT-REC-BOTT-CARRE-HD",
    libelle: "Pressage balles carrées HD (haute densité)",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 28,
    notes: "Balles 80×80×240 cm, ~500-650 kg, transport facilité.",
  },
  {
    code: "MAT-REC-BOTT-CARRE-MS",
    libelle: "Pressage balles carrées Midi-square",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 22,
    notes: "Balles 80×70×220 cm, ~300 kg.",
  },
  {
    code: "MAT-REC-BOTT-PETITES",
    libelle: "Pressage petites balles HD (carrées 30×40)",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 1.8,
    notes: "Petites balles ~20-25 kg, manipulation manuelle.",
  },
  {
    code: "MAT-REC-ENRUB",
    libelle: "Enrubanneuse seule (poste fixe ou auto)",
    categorie: "RECOLTE",
    unite: "FORFAIT",
    prixUnitaireCHF: 14,
    notes: "Pose film étirable sur balles déjà pressées.",
  },
  {
    code: "MAT-REC-REPRISE-BALLES",
    libelle: "Reprise et empilage balles (chargeur télescopique)",
    categorie: "RECOLTE",
    unite: "H",
    prixUnitaireCHF: 90,
  },
  // ─── TRAVAIL DU SOL (compléments) ────────────────────────────────────
  {
    code: "MAT-TRAV-CHARRUE-3",
    libelle: "Labour charrue 3 socs",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 175,
  },
  {
    code: "MAT-TRAV-CHARRUE-5",
    libelle: "Labour charrue 5 socs",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 240,
  },
  {
    code: "MAT-TRAV-CHARRUE-6",
    libelle: "Labour charrue 6 socs",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 270,
  },
  {
    code: "MAT-TRAV-DECH-LEGER",
    libelle: "Déchaumeur léger (à dents fines)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 75,
  },
  {
    code: "MAT-TRAV-DECH-LOURD",
    libelle: "Déchaumeur lourd à disques",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 115,
  },
  {
    code: "MAT-TRAV-MULCH",
    libelle: "Broyage déchaumage (mulcheur)",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 105,
  },
  {
    code: "MAT-TRAV-NIVEL-LASER",
    libelle: "Nivellement laser",
    categorie: "TRAVAIL_DU_SOL",
    unite: "HA",
    prixUnitaireCHF: 220,
    notes: "Nivellement précis pour irrigation gravitaire.",
  },
  // ─── SEMIS (compléments) ─────────────────────────────────────────────
  {
    code: "MAT-SEM-STRIP",
    libelle: "Semis strip-till (préparation localisée)",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 195,
  },
  {
    code: "MAT-SEM-SUR-PRAIRIE",
    libelle: "Sursemis prairie",
    categorie: "SEMIS",
    unite: "HA",
    prixUnitaireCHF: 95,
    notes: "Régénération prairie sans labour.",
  },
  {
    code: "MAT-SEM-PLANT-VIGNE",
    libelle: "Plantation vigne (forfait)",
    categorie: "SEMIS",
    unite: "FORFAIT",
    prixUnitaireCHF: 4500,
    notes: "Plantation vigne complète à l'hectare. À détailler.",
  },
  {
    code: "MAT-SEM-PLANT-ARBRES",
    libelle: "Plantation arbres fruitiers / haie",
    categorie: "SEMIS",
    unite: "H",
    prixUnitaireCHF: 95,
  },
  // ─── FERTILISATION (compléments) ─────────────────────────────────────
  {
    code: "MAT-FERT-RAMPE-24",
    libelle: "Épandeur engrais à rampe 24m",
    categorie: "FERTILISATION",
    unite: "HA",
    prixUnitaireCHF: 35,
  },
  {
    code: "MAT-FERT-RAMPE-36",
    libelle: "Épandeur engrais à rampe 36m",
    categorie: "FERTILISATION",
    unite: "HA",
    prixUnitaireCHF: 42,
  },
  {
    code: "MAT-FERT-CENTRI",
    libelle: "Épandeur centrifuge double-disque",
    categorie: "FERTILISATION",
    unite: "HA",
    prixUnitaireCHF: 38,
  },
  {
    code: "MAT-FERT-LISIER-PEND-12",
    libelle: "Pendillard lisier 12m",
    categorie: "FERTILISATION",
    unite: "M3",
    prixUnitaireCHF: 14,
  },
  {
    code: "MAT-FERT-LISIER-PEND-18",
    libelle: "Pendillard lisier 18m",
    categorie: "FERTILISATION",
    unite: "M3",
    prixUnitaireCHF: 17,
  },
  {
    code: "MAT-FERT-LISIER-PEND-24",
    libelle: "Pendillard lisier 24m",
    categorie: "FERTILISATION",
    unite: "M3",
    prixUnitaireCHF: 20,
  },
  // ─── PROTECTION (compléments) ────────────────────────────────────────
  {
    code: "MAT-PROT-PULV-1500",
    libelle: "Pulvérisateur traîné 1500L",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 55,
  },
  {
    code: "MAT-PROT-PULV-3000",
    libelle: "Pulvérisateur traîné 3000L",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 75,
  },
  {
    code: "MAT-PROT-ATOM-VIGNE",
    libelle: "Atomiseur viticole (face/face)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 95,
  },
  {
    code: "MAT-PROT-DESHERB-THERM",
    libelle: "Désherbage thermique (gaz)",
    categorie: "PROTECTION",
    unite: "HA",
    prixUnitaireCHF: 220,
    notes: "Bio — alternative herbicide.",
  },
  // ─── RÉCOLTE (compléments) ───────────────────────────────────────────
  {
    code: "MAT-REC-FAUCH-DISQUES",
    libelle: "Faucheuse à disques",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 75,
  },
  {
    code: "MAT-REC-FAUCH-COND",
    libelle: "Faucheuse-conditionneuse",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 110,
    notes: "Fauchage + écrasement tiges — séchage accéléré.",
  },
  {
    code: "MAT-REC-ANDAINEUR-2",
    libelle: "Andaineur 2 rangs",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 35,
  },
  {
    code: "MAT-REC-ANDAINEUR-4",
    libelle: "Andaineur 4 rangs",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 50,
  },
  {
    code: "MAT-REC-FANEUSE",
    libelle: "Faneuse / fane fourrage",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 35,
  },
  {
    code: "MAT-REC-BETT-EFFEUIL",
    libelle: "Effeuillage betteraves sucrières",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 95,
  },
  {
    code: "MAT-REC-BETT-INTEG",
    libelle: "Récolteuse betteraves intégrale 6 rangs",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 480,
  },
  {
    code: "MAT-REC-PDT-1RG",
    libelle: "Récolteuse pommes de terre 1 rang",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 380,
  },
  {
    code: "MAT-REC-PDT-2RG",
    libelle: "Récolteuse pommes de terre 2 rangs",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 590,
  },
  {
    code: "MAT-REC-AUTOCHARG",
    libelle: "Autochargeuse fourrage",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 195,
    notes: "Ramassage + transport en un passage — petites parcelles.",
  },
  {
    code: "MAT-REC-PELLE-ENS",
    libelle: "Pelle / fourche d'ensilage (manutention)",
    categorie: "RECOLTE",
    unite: "H",
    prixUnitaireCHF: 95,
  },
  {
    code: "MAT-REC-CUEILL-MAIS",
    libelle: "Cueilleuse maïs grain (bec maïs)",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 70,
    notes: "Supplément à la moissonneuse-batteuse.",
  },
  {
    code: "MAT-REC-CUEILL-TOURNESOL",
    libelle: "Cueilleuse tournesol",
    categorie: "RECOLTE",
    unite: "HA",
    prixUnitaireCHF: 85,
  },
  // ─── ÉLEVAGE / TRAVAUX FERME ────────────────────────────────────────
  {
    code: "MAT-ELEV-MELANGEUSE",
    libelle: "Distribution mélangeuse (vaches/bovins)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 110,
  },
  {
    code: "MAT-ELEV-CURAGE",
    libelle: "Curage stabulation (mini-pelle/manuscrop)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 105,
  },
  {
    code: "MAT-ELEV-PAILLAGE",
    libelle: "Paillage litière (pailleuse)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 75,
  },
  {
    code: "MAT-ELEV-TONTE",
    libelle: "Tonte ovins (forfait par bête)",
    categorie: "AUTRE",
    unite: "FORFAIT",
    prixUnitaireCHF: 8,
  },
  // ─── ENTRETIEN / TRAVAUX SPÉCIAUX ───────────────────────────────────
  {
    code: "MAT-ENT-HAIE-BROYAGE",
    libelle: "Broyage haie / branchages (lamier)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 130,
  },
  {
    code: "MAT-ENT-FOSSE",
    libelle: "Curage de fossé (mini-pelle)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 145,
  },
  {
    code: "MAT-ENT-DRAINAGE-TAUPE",
    libelle: "Pose drainage taupe / soc drainant",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 165,
  },
  {
    code: "MAT-ENT-CLOTURE",
    libelle: "Pose clôture (m linéaire)",
    categorie: "AUTRE",
    unite: "FORFAIT",
    prixUnitaireCHF: 12,
    notes: "Forfait par mètre linéaire — clôture électrique 1 fil.",
  },
  {
    code: "MAT-ENT-DENEIGE",
    libelle: "Déneigement (lame ou fraise)",
    categorie: "AUTRE",
    unite: "H",
    prixUnitaireCHF: 110,
  },
  // ─── TRANSPORT (compléments) ─────────────────────────────────────────
  {
    code: "MAT-TRANS-REMORQUE",
    libelle: "Tracteur + remorque (transport simple)",
    categorie: "TRANSPORT",
    unite: "H",
    prixUnitaireCHF: 85,
  },
  {
    code: "MAT-TRANS-SOLO",
    libelle: "Tracteur seul (transport-déplacement)",
    categorie: "TRANSPORT",
    unite: "H",
    prixUnitaireCHF: 65,
  },
  // ─── DIVERS / FORFAITS ───────────────────────────────────────────────
  {
    code: "MAT-AUT-DEPLACEMENT",
    libelle: "Frais de déplacement (forfait chantier)",
    categorie: "AUTRE",
    unite: "FORFAIT",
    prixUnitaireCHF: 50,
  },
  {
    code: "MAT-AUT-PREP-CHANTIER",
    libelle: "Préparation chantier (mise en route, réglages)",
    categorie: "AUTRE",
    unite: "FORFAIT",
    prixUnitaireCHF: 80,
  },
];

// ─── Produits supplémentaires (Biens) ─────────────────────────────────
interface SeedProduit {
  code: string;
  libelle: string;
  categorie: ProduitCategorie;
  unite: ProduitUnite;
  marque?: string;
  fournisseur?: string;
  especeCode?: string;
  tauxN?: number;
  tauxP?: number;
  tauxK?: number;
  prixVenteCHF?: number;
  notes?: string;
}

const PRODUITS_EXTRA: SeedProduit[] = [
  // Engrais minéraux supplémentaires
  {
    code: "ENG-MIN-NPK-15",
    libelle: "NPK 15-15-15 (équilibré)",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 15,
    tauxP: 15,
    tauxK: 15,
    prixVenteCHF: 850,
    notes: "Engrais polyvalent printemps — toutes cultures.",
  },
  {
    code: "ENG-MIN-NPK-12-12-17",
    libelle: "NPK 12-12-17 + 2 MgO",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 12,
    tauxP: 12,
    tauxK: 17,
    prixVenteCHF: 880,
    notes: "Riche en potasse + Mg — pour pommes de terre / vignes.",
  },
  {
    code: "ENG-MIN-UREE",
    libelle: "Urée 46% N",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 46,
    prixVenteCHF: 720,
    notes: "Engrais azoté concentré — perte volat. NH3 si non incorporé.",
  },
  {
    code: "ENG-MIN-AMMO",
    libelle: "Ammonitrate 27% N",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 27,
    prixVenteCHF: 690,
  },
  {
    code: "ENG-MIN-SULFAM",
    libelle: "Sulfate d'ammoniaque 21% N + 24% S",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 21,
    prixVenteCHF: 580,
  },
  {
    code: "ENG-MIN-KCL",
    libelle: "Chlorure de potasse 60% K2O",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxK: 60,
    prixVenteCHF: 620,
  },
  {
    code: "ENG-MIN-PATENTKALI",
    libelle: "Patentkali 30 K + 10 Mg + 17 S",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxK: 30,
    prixVenteCHF: 740,
  },
  {
    code: "ENG-MIN-SUPER",
    libelle: "Superphosphate triple 46% P2O5",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxP: 46,
    prixVenteCHF: 850,
  },
  {
    code: "ENG-MIN-SOUFRE",
    libelle: "Soufre élémentaire 90%",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    prixVenteCHF: 480,
    notes: "Acidification + apport S — vignes, colza.",
  },
  // Engrais organiques supplémentaires
  {
    code: "ENG-ORG-FUM-BOVIN",
    libelle: "Fumier bovin solide",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.45,
    tauxP: 0.18,
    tauxK: 0.6,
    notes: "5-6 kg N/t. Référence Agridea 1.18.",
  },
  {
    code: "ENG-ORG-FUM-CHEVAL",
    libelle: "Fumier de cheval",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.5,
    tauxP: 0.22,
    tauxK: 0.7,
  },
  {
    code: "ENG-ORG-LIS-BOV",
    libelle: "Lisier bovin (8% MS)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.34,
    tauxP: 0.06,
    tauxK: 0.32,
    notes: "Référence 3.4 kg N/m³ (lisier moyen). Cf Agridea 1.18.",
  },
  {
    code: "ENG-ORG-LIS-PORC",
    libelle: "Lisier porc engraissement",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.55,
    tauxP: 0.12,
    tauxK: 0.25,
    notes: "5.5 kg N/m³ — concentration élevée azote.",
  },
  {
    code: "ENG-ORG-COMPOST",
    libelle: "Compost végétal (15-25% MS)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.7,
    tauxP: 0.3,
    tauxK: 0.8,
  },
  {
    code: "ENG-ORG-DIGESTAT",
    libelle: "Digestat de méthanisation (liquide)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.42,
    tauxP: 0.08,
    tauxK: 0.4,
  },
  {
    code: "ENG-ORG-VINASSE",
    libelle: "Vinasse de betterave (mélasse)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 4,
    tauxK: 7,
    notes: "Sous-produit sucrerie — riche K.",
  },
  // Phytos — compléments courants
  {
    code: "PHY-HERB-GLYPHO",
    libelle: "Glyphosate 360 g/L (Roundup)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 14,
    notes: "Herbicide non-sélectif foliaire. Index OSAV W-7165.",
  },
  {
    code: "PHY-HERB-MCPA",
    libelle: "MCPA 750 g/L",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 22,
    notes: "Herbicide hormonal — céréales, prairies.",
  },
  {
    code: "PHY-HERB-BENTAZ",
    libelle: "Bentazone 480 g/L (Basagran)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 38,
  },
  {
    code: "PHY-FONG-AZOXY",
    libelle: "Azoxystrobine 250 g/L (Score équivalent)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 95,
    notes: "Fongicide systémique large spectre.",
  },
  {
    code: "PHY-FONG-CUIVRE",
    libelle: "Bouillie bordelaise (cuivre)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 8,
    notes: "Fongicide minéral — Bio autorisé. Vignes, fruits.",
  },
  {
    code: "PHY-FONG-SOUFRE",
    libelle: "Soufre micronisé mouillable",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 5,
    notes: "Anti-oïdium — Bio autorisé.",
  },
  {
    code: "PHY-INSEC-DELTA",
    libelle: "Deltaméthrine 25 g/L (Decis)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 65,
  },
  {
    code: "PHY-INSEC-LAMBDA",
    libelle: "Lambda-cyhalothrine 100 g/L (Karaté Zeon)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 88,
  },
  // Autres consommables agricoles
  {
    code: "AUT-FICELLE",
    libelle: "Ficelle balles rondes",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 7,
  },
  {
    code: "AUT-BACHE-ENS",
    libelle: "Bâche d'ensilage 200 µm",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 4.5,
  },
  {
    code: "AUT-FILET-PROT",
    libelle: "Filet de protection (anti-grêle / oiseaux)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 12,
  },
  {
    code: "AUT-CARB-AGRI",
    libelle: "Carburant agricole (diesel rouge)",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 1.65,
  },
  {
    code: "AUT-LUB",
    libelle: "Huile moteur tracteur 15W-40",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 8.5,
  },
  // ─── SEMENCES (compléments — variétés Suisse romande) ───────────────
  {
    code: "SEM-AVOINE-PRINTEMPS",
    libelle: "Avoine de printemps (variété mixte)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "AVO",
    prixVenteCHF: 1.4,
  },
  {
    code: "SEM-TRITICALE",
    libelle: "Triticale d'automne",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "TRI",
    prixVenteCHF: 1.3,
  },
  {
    code: "SEM-EPEAUTRE",
    libelle: "Épeautre (Triticum spelta)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "EPE",
    prixVenteCHF: 1.8,
  },
  {
    code: "SEM-SEIGLE",
    libelle: "Seigle d'automne (population)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "SEI",
    prixVenteCHF: 1.5,
  },
  {
    code: "SEM-COLZA-HIVER",
    libelle: "Colza d'hiver (variété hybride)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "COL",
    prixVenteCHF: 28,
    notes: "Densité ~3-4 kg/ha en hybride.",
  },
  {
    code: "SEM-TOURNESOL",
    libelle: "Tournesol oléique (hybride)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "TOU",
    prixVenteCHF: 35,
  },
  {
    code: "SEM-SOJA",
    libelle: "Soja (variété 0/00)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "SOJ",
    prixVenteCHF: 4.5,
  },
  {
    code: "SEM-SARRASIN",
    libelle: "Sarrasin",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "SAR",
    prixVenteCHF: 2.8,
  },
  {
    code: "SEM-LIN-OLE",
    libelle: "Lin oléagineux",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "LIN",
    prixVenteCHF: 4.2,
  },
  {
    code: "SEM-CHANVRE",
    libelle: "Chanvre industriel (CBD < 0.3%)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "CHA",
    prixVenteCHF: 18,
  },
  {
    code: "SEM-SORGHO",
    libelle: "Sorgho fourrager",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "SOR",
    prixVenteCHF: 6.5,
  },
  {
    code: "SEM-MILLET",
    libelle: "Millet perlé",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "MIL",
    prixVenteCHF: 5.2,
  },
  {
    code: "SEM-POIS-PROT",
    libelle: "Pois protéagineux",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "POI",
    prixVenteCHF: 1.6,
  },
  {
    code: "SEM-FEVEROLE",
    libelle: "Féverole",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "FEV",
    prixVenteCHF: 1.5,
  },
  {
    code: "SEM-LUPIN",
    libelle: "Lupin blanc",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "LUP",
    prixVenteCHF: 3.2,
  },
  {
    code: "SEM-VESCE",
    libelle: "Vesce velue (engrais vert)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "VES",
    prixVenteCHF: 4.5,
  },
  {
    code: "SEM-MOUTARDE",
    libelle: "Moutarde blanche (dérobée)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "MOU",
    prixVenteCHF: 3.8,
  },
  {
    code: "SEM-RADIS",
    libelle: "Radis fourrager (dérobée)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "RAD",
    prixVenteCHF: 6.5,
  },
  {
    code: "SEM-PHACELIE",
    libelle: "Phacélie (engrais vert mellifère)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PHA",
    prixVenteCHF: 8.5,
  },
  {
    code: "SEM-TREFLE-INC",
    libelle: "Trèfle incarnat (dérobée)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "TIN",
    prixVenteCHF: 4.5,
  },
  // Pommes de terre — variétés courantes Suisse
  {
    code: "SEM-PDT-CHARLOTTE",
    libelle: "Pomme de terre — Charlotte (chair ferme)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PDT",
    marque: "Charlotte",
    prixVenteCHF: 1.2,
    notes: "Variété de table, chair ferme, mi-précoce.",
  },
  {
    code: "SEM-PDT-AGRIA",
    libelle: "Pomme de terre — Agria (frites/conso)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PDT",
    marque: "Agria",
    prixVenteCHF: 1.1,
  },
  {
    code: "SEM-PDT-DITTA",
    libelle: "Pomme de terre — Ditta (chair ferme bio)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PDT",
    marque: "Ditta",
    prixVenteCHF: 1.3,
  },
  {
    code: "SEM-PDT-ANNABELLE",
    libelle: "Pomme de terre — Annabelle (précoce)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PDT",
    marque: "Annabelle",
    prixVenteCHF: 1.4,
  },
  {
    code: "SEM-PDT-ERIKA",
    libelle: "Pomme de terre — Erika (industrielle)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PDT",
    marque: "Erika",
    prixVenteCHF: 1.05,
  },
  {
    code: "SEM-PDT-INNOVATOR",
    libelle: "Pomme de terre — Innovator (frites)",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "PDT",
    marque: "Innovator",
    prixVenteCHF: 1.1,
  },
  // Betterave
  {
    code: "SEM-BETT-SUCRE",
    libelle: "Betterave sucrière (variété confiseur)",
    categorie: "SEMENCE",
    unite: "DOSE",
    especeCode: "BES",
    prixVenteCHF: 250,
    notes: "Dose standard 130 000 graines / ha.",
  },
  {
    code: "SEM-BETT-FOUR",
    libelle: "Betterave fourragère",
    categorie: "SEMENCE",
    unite: "KG",
    especeCode: "BEF",
    prixVenteCHF: 18,
  },
  // ─── ENGRAIS MINÉRAUX (compléments) ──────────────────────────────────
  {
    code: "ENG-MIN-NPK-START",
    libelle: "Engrais starter NP 15-46-0",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 15,
    tauxP: 46,
    prixVenteCHF: 920,
    notes: "Phosphate ammoniacal — micro-localisé au semis maïs/PdT.",
  },
  {
    code: "ENG-MIN-K-SULF",
    libelle: "Sulfate de potasse 50% K + 18% S",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxK: 50,
    prixVenteCHF: 920,
  },
  {
    code: "ENG-MIN-CYANAMIDE",
    libelle: "Cyanamide calcique (Perlka)",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxN: 19.8,
    prixVenteCHF: 1100,
    notes: "Engrais azoté + désinfection sol — colza, choux.",
  },
  {
    code: "ENG-MIN-PHOS-NAT",
    libelle: "Phosphate naturel (poudre)",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    tauxP: 28,
    prixVenteCHF: 320,
    notes: "Bio autorisé — libération lente.",
  },
  {
    code: "ENG-MIN-LITHO",
    libelle: "Lithothamne (algues calcaires)",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    prixVenteCHF: 480,
    notes: "Apport Ca + oligo-éléments — Bio autorisé.",
  },
  {
    code: "ENG-MIN-MGSO4",
    libelle: "Sulfate de magnésium kieserite",
    categorie: "ENGRAIS_MINERAL",
    unite: "T",
    prixVenteCHF: 540,
    notes: "Apport Mg + S — toutes cultures.",
  },
  {
    code: "ENG-MIN-FOL-MICRO",
    libelle: "Engrais foliaire micronutriments (B-Mn-Zn)",
    categorie: "ENGRAIS_MINERAL",
    unite: "L",
    prixVenteCHF: 18,
    notes: "Correction carences ponctuelles — pulvérisation.",
  },
  // ─── ENGRAIS ORGANIQUES (compléments) ────────────────────────────────
  {
    code: "ENG-ORG-FUM-PORC",
    libelle: "Fumier porc (mélangé)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.6,
    tauxP: 0.4,
    tauxK: 0.5,
  },
  {
    code: "ENG-ORG-FUM-VOL",
    libelle: "Fumier de volailles",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 2.5,
    tauxP: 1.8,
    tauxK: 1.6,
    notes: "Très concentré — limite 10-15 t/ha.",
  },
  {
    code: "ENG-ORG-FUM-OVIN",
    libelle: "Fumier ovins/caprins",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 0.8,
    tauxP: 0.4,
    tauxK: 1.2,
  },
  {
    code: "ENG-ORG-LIS-MIXTE",
    libelle: "Lisier mixte (vaches + porcs)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "M3",
    tauxN: 0.4,
    tauxP: 0.08,
    tauxK: 0.32,
  },
  {
    code: "ENG-ORG-PLUMES",
    libelle: "Farine de plumes (azote organique)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 13,
    prixVenteCHF: 1450,
    notes: "Bio autorisé — libération lente.",
  },
  {
    code: "ENG-ORG-SANG",
    libelle: "Sang séché",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 12,
    prixVenteCHF: 1700,
  },
  {
    code: "ENG-ORG-CORNE",
    libelle: "Corne broyée",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 14,
    prixVenteCHF: 2100,
  },
  {
    code: "ENG-ORG-BOUCHONS",
    libelle: "Bouchons fumier compacté (bio)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "T",
    tauxN: 4.5,
    tauxP: 2.5,
    tauxK: 4.5,
    prixVenteCHF: 480,
  },
  {
    code: "ENG-ORG-ALGUES",
    libelle: "Algues marines (poudre)",
    categorie: "ENGRAIS_ORGANIQUE",
    unite: "KG",
    prixVenteCHF: 6.5,
    notes: "Bio — apport oligos + biostimulant.",
  },
  // ─── PHYTOSANITAIRES (compléments — sélection OSAV courants) ────────
  // Herbicides céréales
  {
    code: "PHY-HERB-IODOSULF",
    libelle: "Iodosulfuron (Husar)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 380,
    notes: "Sulfonylurée — graminées + dicots céréales hiver.",
  },
  {
    code: "PHY-HERB-FLORASULAM",
    libelle: "Florasulam + 2,4-D (Primus)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 95,
  },
  {
    code: "PHY-HERB-DIFLUFEN",
    libelle: "Diflufenican + flufenacet",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 180,
    notes: "Pré-levée céréales — graminées et dicots.",
  },
  // Herbicides maïs
  {
    code: "PHY-HERB-MESOTRIONE",
    libelle: "Mésotrione 100 g/L (Callisto)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 110,
  },
  {
    code: "PHY-HERB-NICOSULF",
    libelle: "Nicosulfuron 40 g/L",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 145,
  },
  {
    code: "PHY-HERB-PENDIM",
    libelle: "Pendiméthaline 400 g/L (Stomp Aqua)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 25,
  },
  {
    code: "PHY-HERB-SMETO",
    libelle: "S-métolachlore (Dual Gold)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 38,
  },
  // Herbicides betteraves
  {
    code: "PHY-HERB-PHENMED",
    libelle: "Phenmedipham 160 g/L (Betanal)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 65,
  },
  {
    code: "PHY-HERB-METAMIT",
    libelle: "Métamitrone 700 g/L (Goltix)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 32,
  },
  // Herbicides colza
  {
    code: "PHY-HERB-METAZACHLORE",
    libelle: "Métazachlore + quinmerac",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 55,
  },
  {
    code: "PHY-HERB-CLOPYRALID",
    libelle: "Clopyralid 100 g/L (Lontrel)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 220,
  },
  // Herbicides PdT
  {
    code: "PHY-HERB-METRIBUZ",
    libelle: "Métribuzine 70% (Sencor)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 95,
  },
  {
    code: "PHY-HERB-PROSULF",
    libelle: "Prosulfocarbe 800 g/L (Defi)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 22,
  },
  // Fongicides céréales
  {
    code: "PHY-FONG-TEBUCO",
    libelle: "Tébuconazole 250 g/L (Folicur)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 48,
  },
  {
    code: "PHY-FONG-PROTHIO",
    libelle: "Prothioconazole 250 g/L",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 95,
  },
  {
    code: "PHY-FONG-BIXAFEN",
    libelle: "Bixafène + prothioconazole (Aviator)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 110,
  },
  {
    code: "PHY-FONG-FLUXAPYROXAD",
    libelle: "Fluxapyroxad + époxiconazole (Adexar)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 135,
  },
  {
    code: "PHY-FONG-PYRACLO",
    libelle: "Pyraclostrobine + époxiconazole (Opera)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 125,
  },
  // Fongicides PdT
  {
    code: "PHY-FONG-MANDIPRO",
    libelle: "Mandipropamide 250 g/L (Revus)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 215,
    notes: "Mildiou pomme de terre.",
  },
  {
    code: "PHY-FONG-FLUAZINAM",
    libelle: "Fluazinam 500 g/L (Shirlan)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 145,
  },
  {
    code: "PHY-FONG-CYMOXANIL",
    libelle: "Cymoxanil + mancozèbe",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 58,
  },
  // Fongicides vignes
  {
    code: "PHY-FONG-FOSETYL",
    libelle: "Fosétyl-Al (Aliette)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 32,
  },
  {
    code: "PHY-FONG-MEFENO",
    libelle: "Méfénoxam + cuivre (Ridomil)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 48,
  },
  // Insecticides
  {
    code: "PHY-INSEC-PIRIMI",
    libelle: "Pirimicarbe 50% (Pirimor)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 165,
    notes: "Aphicide sélectif — épargne auxiliaires.",
  },
  {
    code: "PHY-INSEC-SPINOSAD",
    libelle: "Spinosad 480 g/L (Audienz)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 220,
    notes: "Bio autorisé — chenilles, thrips.",
  },
  {
    code: "PHY-INSEC-PYRETHRINE",
    libelle: "Pyréthrines naturelles (Pyrethrum FS)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 145,
    notes: "Bio.",
  },
  {
    code: "PHY-INSEC-INDOXACARBE",
    libelle: "Indoxacarbe 150 g/L (Steward)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 220,
  },
  // Régulateurs croissance
  {
    code: "PHY-REG-CCC",
    libelle: "Chlorméquat (CCC) 720 g/L",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 12,
    notes: "Raccourcisseur tiges céréales.",
  },
  {
    code: "PHY-REG-MODDUS",
    libelle: "Trinexapac-ethyl (Moddus)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 95,
  },
  // Limaces / mouilleurs
  {
    code: "PHY-LIM-FERRI",
    libelle: "Ferri-phosphate (Sluxx) — anti-limaces bio",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 8.5,
  },
  {
    code: "PHY-LIM-METALD",
    libelle: "Métaldéhyde (Mesurol)",
    categorie: "PHYTO",
    unite: "KG",
    prixVenteCHF: 6.5,
  },
  {
    code: "PHY-MOUIL-STICKER",
    libelle: "Mouillant adjuvant (Sticker)",
    categorie: "PHYTO",
    unite: "L",
    prixVenteCHF: 12,
  },
  // ─── ALIMENTS BÉTAIL ─────────────────────────────────────────────────
  {
    code: "ALI-FOIN",
    libelle: "Foin de prairie",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.32,
  },
  {
    code: "ALI-REGAIN",
    libelle: "Regain (2e/3e coupe)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.42,
  },
  {
    code: "ALI-PAILLE",
    libelle: "Paille (litière + alimentation)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.12,
  },
  {
    code: "ALI-ENS-MAIS",
    libelle: "Ensilage maïs",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.18,
  },
  {
    code: "ALI-ENS-HERBE",
    libelle: "Ensilage herbe (graminée + légumineuses)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.22,
  },
  {
    code: "ALI-CONC-16",
    libelle: "Concentré bovin 16% protéine brute",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.55,
  },
  {
    code: "ALI-CONC-18",
    libelle: "Concentré bovin 18% PB (lait moyen)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.62,
  },
  {
    code: "ALI-CONC-22",
    libelle: "Concentré 22% PB (haute production)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.74,
  },
  {
    code: "ALI-TOURT-SOJA",
    libelle: "Tourteau soja extrudé",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.68,
  },
  {
    code: "ALI-TOURT-COLZA",
    libelle: "Tourteau colza",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.42,
  },
  {
    code: "ALI-PULPE-BETT",
    libelle: "Pulpe de betterave (séchée)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.32,
  },
  {
    code: "ALI-DRECHE",
    libelle: "Drêche de brasserie",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.18,
  },
  {
    code: "ALI-SEL-CURE",
    libelle: "Sel de cure (bloc lèche)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.95,
  },
  {
    code: "ALI-MIN-VL",
    libelle: "Aliment minéral vache laitière",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 1.85,
  },
  {
    code: "ALI-LAIT-VEAU",
    libelle: "Aliment d'allaitement (poudre)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 3.2,
  },
  // ─── LITIÈRE ────────────────────────────────────────────────────────
  {
    code: "LIT-PAILLE-BLE",
    libelle: "Paille de blé (litière)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.1,
  },
  {
    code: "LIT-SCIURE",
    libelle: "Sciure de bois résineux",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.18,
  },
  {
    code: "LIT-COPEAUX",
    libelle: "Copeaux de bois",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.22,
  },
  {
    code: "LIT-TOURBE",
    libelle: "Tourbe (litière chevaux)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.45,
  },
  {
    code: "LIT-PLAQUETTES",
    libelle: "Plaquettes de bois (chauffage / litière)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.08,
  },
  // ─── PRODUITS VÉTÉRINAIRES (génériques) ─────────────────────────────
  {
    code: "VET-IVERMECT",
    libelle: "Ivermectine (vermifuge)",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 145,
  },
  {
    code: "VET-FENBEND",
    libelle: "Fenbendazole (vermifuge)",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 95,
  },
  {
    code: "VET-DESINFECT",
    libelle: "Désinfectant peau (Vétédine)",
    categorie: "AUTRE",
    unite: "L",
    prixVenteCHF: 28,
  },
  {
    code: "VET-PANSEMENT",
    libelle: "Bandage cohésif (kit)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 18,
  },
  // ─── CONSOMMABLES (compléments) ──────────────────────────────────────
  {
    code: "AUT-FILET-ENRUB",
    libelle: "Filet enrubannage balles rondes",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 9,
  },
  {
    code: "AUT-FILM-BALLES",
    libelle: "Film étirable balles silo",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 5.5,
  },
  {
    code: "AUT-PIQUET-CLOTURE",
    libelle: "Piquet clôture (bois traité)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 3.5,
    notes: "Forfait par piquet de 1.5m.",
  },
  {
    code: "AUT-FIL-GALV",
    libelle: "Fil galvanisé clôture (rouleau 250m)",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 2.8,
  },
  {
    code: "AUT-ISOL-CLOTURE",
    libelle: "Isolateur clôture électrique",
    categorie: "AUTRE",
    unite: "KG",
    prixVenteCHF: 0.9,
  },
];

async function purge() {
  console.log("🗑️  Suppression de TOUS les Produits et Matériels (globaux + perso)…");

  const delMateriels = await prisma.materiel.deleteMany({});
  console.log(`   ✓ ${delMateriels.count} matériels supprimés`);

  const delProduits = await prisma.produit.deleteMany({});
  console.log(`   ✓ ${delProduits.count} produits supprimés`);
}

async function reseedMateriels() {
  console.log("\n🌱 Re-seed des matériels (sous-process seed-materiels.ts)…");
  // On délègue à un sous-process pour isoler le client Prisma du seed
  // officiel (qui fait son propre $disconnect au top-level).
  execSync("pnpm tsx prisma/seed-materiels.ts", { stdio: "inherit" });

  // Ajouts complémentaires (idempotent : upsert par code).
  let added = 0;
  for (const m of MATERIELS_EXTRA) {
    await prisma.materiel.upsert({
      where: { code: m.code },
      update: {
        libelle: m.libelle,
        categorie: m.categorie,
        unite: m.unite,
        prixUnitaireCHF: m.prixUnitaireCHF,
        notes: m.notes ?? null,
      },
      create: {
        code: m.code,
        libelle: m.libelle,
        categorie: m.categorie,
        unite: m.unite,
        prixUnitaireCHF: m.prixUnitaireCHF,
        notes: m.notes ?? null,
        actif: true,
      },
    });
    added++;
  }
  console.log(`   ✓ ${added} matériels supplémentaires upsertés`);
}

async function reseedProduits() {
  console.log("\n🌱 Re-seed des produits (sous-process seed-produits.ts)…");
  execSync("pnpm tsx prisma/seed-produits.ts", { stdio: "inherit" });

  let added = 0;
  for (const p of PRODUITS_EXTRA) {
    await prisma.produit.upsert({
      where: { code: p.code },
      update: {
        libelle: p.libelle,
        categorie: p.categorie,
        unite: p.unite,
        marque: p.marque ?? null,
        fournisseur: p.fournisseur ?? null,
        especeCode: p.especeCode ?? null,
        tauxN: p.tauxN ?? null,
        tauxP: p.tauxP ?? null,
        tauxK: p.tauxK ?? null,
        prixVenteCHF: p.prixVenteCHF ?? null,
        notes: p.notes ?? null,
      },
      create: {
        code: p.code,
        libelle: p.libelle,
        categorie: p.categorie,
        unite: p.unite,
        marque: p.marque ?? null,
        fournisseur: p.fournisseur ?? null,
        especeCode: p.especeCode ?? null,
        tauxN: p.tauxN ?? null,
        tauxP: p.tauxP ?? null,
        tauxK: p.tauxK ?? null,
        prixVenteCHF: p.prixVenteCHF ?? null,
        notes: p.notes ?? null,
        actif: true,
      },
    });
    added++;
  }
  console.log(`   ✓ ${added} produits supplémentaires upsertés`);
}

async function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log(" Reset catalogue Agri Qodo — Produits + Matériels");
  console.log("══════════════════════════════════════════════════════════");

  await purge();
  await reseedMateriels();
  await reseedProduits();

  const totalMat = await prisma.materiel.count();
  const totalProd = await prisma.produit.count();
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(` ✓ Catalogue final : ${totalMat} matériels · ${totalProd} produits`);
  console.log("══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("✗ Erreur reset catalogue :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
