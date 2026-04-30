/**
 * Seed prod / démo enrichi.
 *
 * Cible 1 — Compte dev local (Marie Rolet) : isolé, jamais touché par les
 * autres seeds. Sert au développement local.
 *
 * Cible 2 — Tenant **partagé "Démo Agri Qodo"** :
 *   - admin@admin.ch / admin       → rôle OWNER (accès complet)
 *   - demo@demo.ch / demo          → rôle EMPLOYE (lecture + saisie limitée)
 *   Tous deux sur le **même tenant**, donc voient les mêmes données.
 *
 * Données fictives sur le tenant démo : 10 parcelles autour d'Yverdon,
 * cheptel mixte (laitières + génisses + veaux + chevaux + brebis + porcs),
 * cultures, interventions historiques, travaux + lignes heures.
 *
 * Idempotent : si le tenant démo existe déjà, son contenu est purgé puis
 * recréé. Le tenant dev (Marie) n'est jamais touché.
 *
 * Lancer : `pnpm --filter @agri-qodo/backend db:seed`
 *  ou en prod : `docker compose exec backend tsx prisma/seed.ts`
 */
import {
  type AnimalCategorie,
  Canton,
  PrismaClient,
  TravailStatut,
  UserRole,
  ZoneAgricole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ============================================================================
// COMPTE DEV (Marie Rolet) — isolé, juste user + tenant minimal
// ============================================================================

const DEV_TENANT = {
  code: "AQ-VD-1247-DEV",
  nom: "Ferme Rolet (dev)",
  canton: Canton.VD,
  numeroUfam: "1247",
  npa: "1141",
  localite: "Sévery",
  emailContact: "marie@ferme-rolet.test",
  user: {
    email: "marie@ferme-rolet.test",
    password: "DemoPassword123!",
    prenom: "Marie",
    nom: "Rolet",
  },
};

async function seedDevTenant(): Promise<void> {
  const tenant = await prisma.exploitation.upsert({
    where: { code: DEV_TENANT.code },
    update: {},
    create: {
      code: DEV_TENANT.code,
      nom: DEV_TENANT.nom,
      canton: DEV_TENANT.canton,
      numeroUfam: DEV_TENANT.numeroUfam,
      npa: DEV_TENANT.npa,
      localite: DEV_TENANT.localite,
      emailContact: DEV_TENANT.emailContact,
    },
  });
  const passwordHash = await bcrypt.hash(DEV_TENANT.user.password, 10);
  await prisma.user.upsert({
    where: { email_tenantId: { email: DEV_TENANT.user.email, tenantId: tenant.id } },
    update: {},
    create: {
      email: DEV_TENANT.user.email,
      passwordHash,
      prenom: DEV_TENANT.user.prenom,
      nom: DEV_TENANT.user.nom,
      role: UserRole.OWNER,
      tenantId: tenant.id,
    },
  });
  console.log(`✓ Dev : ${DEV_TENANT.user.email} / ${DEV_TENANT.user.password}`);
}

// ============================================================================
// TENANT DÉMO PARTAGÉ — admin + demo sur le même tenant
// ============================================================================

const DEMO_CODE = "AQ-VD-DEMO-PUBLIC";

interface DemoParcelle {
  nom: string;
  surfaceM2: number;
  zone: ZoneAgricole;
  geomGeoJson: string;
  culture?: { espece: string; campagne: number; dateSemis: Date };
}

// Zone agricole pure du Gros-de-Vaud (entre Goumoens-la-Ville et Bottens),
// loin de toute zone urbaine. Coordonnées choisies sur Swisstopo pour
// matcher de vrais champs visibles en vue satellite. Espacement entre
// parcelles ≥ 100m pour pas de chevauchement.
const DEMO_PARCELLES: DemoParcelle[] = [
  {
    nom: "Champ du Bas",
    surfaceM2: 38_400,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.598, 46.68],
            [6.602, 46.6798],
            [6.6024, 46.6818],
            [6.5982, 46.682],
            [6.598, 46.68],
          ],
        ],
      ],
    }),
    culture: { espece: "ble_panifiable", campagne: 2026, dateSemis: new Date("2025-10-12") },
  },
  {
    nom: "Pré du Moulin",
    surfaceM2: 21_500,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.604, 46.68],
            [6.6072, 46.68],
            [6.6072, 46.6814],
            [6.6038, 46.6815],
            [6.604, 46.68],
          ],
        ],
      ],
    }),
    culture: { espece: "prairie_temporaire", campagne: 2026, dateSemis: new Date("2025-04-15") },
  },
  {
    nom: "La Combe",
    surfaceM2: 64_200,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.609, 46.6798],
            [6.6135, 46.68],
            [6.6138, 46.6822],
            [6.6088, 46.682],
            [6.609, 46.6798],
          ],
        ],
      ],
    }),
    culture: { espece: "mais_ensilage", campagne: 2026, dateSemis: new Date("2026-04-22") },
  },
  {
    nom: "Le Crêt",
    surfaceM2: 17_800,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.598, 46.675],
            [6.601, 46.6748],
            [6.601, 46.677],
            [6.5982, 46.6772],
            [6.598, 46.675],
          ],
        ],
      ],
    }),
    culture: { espece: "colza", campagne: 2026, dateSemis: new Date("2025-08-25") },
  },
  {
    nom: "Vers les Bois",
    surfaceM2: 32_700,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.6035, 46.6748],
            [6.6072, 46.675],
            [6.6072, 46.6772],
            [6.6033, 46.677],
            [6.6035, 46.6748],
          ],
        ],
      ],
    }),
    culture: { espece: "orge_printemps", campagne: 2026, dateSemis: new Date("2026-03-10") },
  },
  {
    nom: "La Touvière",
    surfaceM2: 45_300,
    zone: ZoneAgricole.ZP,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.609, 46.6748],
            [6.614, 46.675],
            [6.614, 46.6776],
            [6.6088, 46.6774],
            [6.609, 46.6748],
          ],
        ],
      ],
    }),
    culture: { espece: "prairie_permanente", campagne: 2026, dateSemis: new Date("2020-04-01") },
  },
  {
    nom: "Champ Bénézit",
    surfaceM2: 28_900,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.5985, 46.6705],
            [6.602, 46.6702],
            [6.6022, 46.6722],
            [6.5985, 46.6724],
            [6.5985, 46.6705],
          ],
        ],
      ],
    }),
    culture: { espece: "tournesol", campagne: 2026, dateSemis: new Date("2026-04-05") },
  },
  {
    nom: "Les Esserts",
    surfaceM2: 51_200,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.6035, 46.67],
            [6.609, 46.6702],
            [6.609, 46.673],
            [6.6033, 46.6728],
            [6.6035, 46.67],
          ],
        ],
      ],
    }),
    culture: { espece: "betterave_sucre", campagne: 2026, dateSemis: new Date("2026-04-12") },
  },
  {
    nom: "Sur la Roche",
    surfaceM2: 12_400,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.612, 46.671],
            [6.6145, 46.671],
            [6.6145, 46.6722],
            [6.6118, 46.6722],
            [6.612, 46.671],
          ],
        ],
      ],
    }),
    culture: { espece: "pomme_de_terre", campagne: 2026, dateSemis: new Date("2026-04-18") },
  },
  {
    nom: "Le Verger",
    surfaceM2: 9_800,
    zone: ZoneAgricole.ZA,
    geomGeoJson: JSON.stringify({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [6.6005, 46.665],
            [6.603, 46.665],
            [6.603, 46.6665],
            [6.6005, 46.6665],
            [6.6005, 46.665],
          ],
        ],
      ],
    }),
  },
];

// Cheptel : 35 laitières + 12 génisses + 8 veaux + ovins + chevaux + porcs
const DEMO_VACHES_LAITIERES_NOMS = [
  "Marguerite",
  "Bella",
  "Cassiopée",
  "Daisy",
  "Étoile",
  "Fleur",
  "Gaïa",
  "Héloïse",
  "Iris",
  "Joconde",
  "Kalinka",
  "Luna",
  "Mimosa",
  "Naïa",
  "Ondine",
  "Perle",
  "Quenelle",
  "Rébecca",
  "Suzon",
  "Tulipe",
  "Ursule",
  "Vénus",
  "Wendy",
  "Xena",
  "Yseult",
  "Zélie",
  "Aurore",
  "Berthe",
  "Camille",
  "Diane",
  "Élise",
  "Fanny",
  "Gabrielle",
  "Hortense",
  "Inès",
];

const DEMO_CHEPTEL: Array<{
  categorie: AnimalCategorie;
  nombre: number;
  nommer?: boolean;
  usage?: string;
  bvd?: string;
  label?: string;
}> = [
  {
    categorie: "VACHE_LAITIERE",
    nombre: 35,
    nommer: true,
    usage: "laitiere",
    bvd: "frei",
    label: "ips",
  },
  { categorie: "GENISSE", nombre: 12, usage: "reproduction", bvd: "frei", label: "ips" },
  { categorie: "VEAU", nombre: 8, usage: "jeune", bvd: "frei" },
  { categorie: "TAUREAU", nombre: 1, nommer: true, usage: "reproduction", bvd: "frei" },
  { categorie: "BREBIS", nombre: 28, usage: "laitiere", label: "bio" },
  { categorie: "BELIER", nombre: 2, usage: "reproduction" },
  { categorie: "AGNEAU", nombre: 14, usage: "jeune" },
  { categorie: "CHEVAL_ADULTE", nombre: 3, nommer: true, usage: "loisir" },
  { categorie: "PORC", nombre: 18, usage: "engraissement" },
  { categorie: "TRUIE", nombre: 4, usage: "reproduction" },
  { categorie: "POULE_PONDEUSE", nombre: 80, label: "bio" },
  { categorie: "POULET", nombre: 220, usage: "engraissement" },
  { categorie: "CHEVRE", nombre: 6, usage: "laitiere", label: "bio" },
  { categorie: "ABEILLE_RUCHE", nombre: 4 },
];

const DEMO_CHEVAUX_NOMS = ["Tornado", "Galopin", "Pâquerette"];

function bdtaNumberFor(i: number): string {
  // CH 120.{4 chiffres}.{1 chiffre} — format BDTA
  const seq = String(i).padStart(4, "0");
  return `CH 120.1304.${seq}`;
}

async function purgeDemoTenant(): Promise<string | null> {
  const existing = await prisma.exploitation.findUnique({ where: { code: DEMO_CODE } });
  if (!existing) return null;
  // Cascade : Animal/Parcelle/Travail/etc ont onDelete: Cascade.
  // Pour les modèles sans cascade explicite, on nettoie à la main :
  await prisma.ligneTravailHeure.deleteMany({ where: { travail: { tenantId: existing.id } } });
  await prisma.ligneTravailProduit.deleteMany({ where: { travail: { tenantId: existing.id } } });
  await prisma.travail.deleteMany({ where: { tenantId: existing.id } });
  await prisma.intervention.deleteMany({ where: { ownerTenantId: existing.id } });
  await prisma.culture.deleteMany({ where: { tenantId: existing.id } });
  await prisma.animal.deleteMany({ where: { tenantId: existing.id } });
  await prisma.sortieSrpa.deleteMany({ where: { tenantId: existing.id } });
  await prisma.parcelle.deleteMany({ where: { tenantId: existing.id } });
  await prisma.user.deleteMany({ where: { tenantId: existing.id } });
  await prisma.exploitation.delete({ where: { id: existing.id } });
  console.log(`✓ Tenant démo purgé (${DEMO_CODE})`);
  return existing.id;
}

async function seedDemoTenant(): Promise<void> {
  await purgeDemoTenant();

  const tenant = await prisma.exploitation.create({
    data: {
      code: DEMO_CODE,
      nom: "Ferme de Démo",
      canton: Canton.VD,
      numeroUfam: "9999",
      numeroBdta: "CH-1304",
      adresse: "Route des Champs 12",
      npa: "1042",
      localite: "Bottens",
      emailContact: "demo@demo.ch",
      telephone: "+41 21 123 45 67",
      visibleInDirectory: true,
    },
  });

  // ---- Users : OWNER + EMPLOYE sur le même tenant -----------------------
  const adminHash = await bcrypt.hash("admin", 10);
  const demoHash = await bcrypt.hash("demo", 10);
  await prisma.user.create({
    data: {
      email: "admin@admin.ch",
      passwordHash: adminHash,
      prenom: "Alice",
      nom: "Admin",
      role: UserRole.OWNER,
      tenantId: tenant.id,
    },
  });
  await prisma.user.create({
    data: {
      email: "demo@demo.ch",
      passwordHash: demoHash,
      prenom: "Demo",
      nom: "Employé",
      role: UserRole.EMPLOYE,
      tenantId: tenant.id,
    },
  });

  // ---- Parcelles + cultures --------------------------------------------
  const parcelleIds: Record<string, string> = {};
  for (const p of DEMO_PARCELLES) {
    const created = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO parcelles (id, tenant_id, nom, surface_m2, zone, geom, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${tenant.id}::uuid,
        ${p.nom},
        ${p.surfaceM2},
        ${p.zone}::"ZoneAgricole",
        ST_Multi(ST_GeomFromGeoJSON(${p.geomGeoJson})),
        now(),
        now()
      )
      RETURNING id::text
    `;
    const parcelleId = created[0]?.id;
    if (!parcelleId) continue;
    parcelleIds[p.nom] = parcelleId;
    if (p.culture) {
      await prisma.culture.create({
        data: {
          tenantId: tenant.id,
          parcelleId,
          espece: p.culture.espece,
          campagne: p.culture.campagne,
          dateSemis: p.culture.dateSemis,
        },
      });
    }
  }

  // ---- Cheptel ---------------------------------------------------------
  let bdtaCounter = 1000;
  for (const c of DEMO_CHEPTEL) {
    for (let i = 0; i < c.nombre; i++) {
      let nom: string | null = null;
      let numeroBoucle: string | null = null;
      let dateNaissance: Date | null = null;
      const isBovin = ["VACHE_LAITIERE", "GENISSE", "VEAU", "TAUREAU"].includes(c.categorie);
      if (c.nommer) {
        if (c.categorie === "VACHE_LAITIERE") {
          nom = DEMO_VACHES_LAITIERES_NOMS[i] ?? `Vache ${i + 1}`;
        } else if (c.categorie === "TAUREAU") {
          nom = "Hercule";
        } else if (c.categorie === "CHEVAL_ADULTE") {
          nom = DEMO_CHEVAUX_NOMS[i] ?? `Cheval ${i + 1}`;
        }
      }
      if (isBovin) {
        bdtaCounter++;
        numeroBoucle = bdtaNumberFor(bdtaCounter);
        // Âge plausible : laitières 3-8 ans, génisses 1-2 ans, veaux 0-1 an
        const ageMois =
          c.categorie === "VACHE_LAITIERE"
            ? 36 + Math.floor(Math.random() * 60)
            : c.categorie === "GENISSE"
              ? 12 + Math.floor(Math.random() * 12)
              : c.categorie === "VEAU"
                ? Math.floor(Math.random() * 8)
                : 36 + Math.floor(Math.random() * 24);
        dateNaissance = new Date(Date.now() - ageMois * 30 * 86_400_000);
      }
      await prisma.animal.create({
        data: {
          tenantId: tenant.id,
          categorie: c.categorie,
          nom,
          numeroBoucle,
          dateNaissance,
          sexe:
            c.categorie === "TAUREAU" || c.categorie === "BELIER" || c.categorie === "BOUC"
              ? "M"
              : "F",
          ...(c.usage ? { usage: c.usage } : {}),
          ...(c.bvd ? { statutBvd: c.bvd } : {}),
          ...(c.label ? { secteurLabel: c.label } : {}),
        },
      });
    }
  }

  // ---- Travaux : qq exemples -------------------------------------------
  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "admin@admin.ch" },
  });
  const demoUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "demo@demo.ch" },
  });
  if (adminUser && demoUser) {
    const today = new Date();
    const daysAgo = (d: number) => new Date(today.getTime() - d * 86_400_000);
    const travauxData = [
      {
        titre: "Récolte du Champ du Bas",
        date: daysAgo(2),
        parcelleNom: "Champ du Bas",
        statut: TravailStatut.VALIDATED,
        interne: false,
        heures: [
          { userId: adminUser.id, dureeMinutes: 240, taux: 85 },
          { userId: demoUser.id, dureeMinutes: 180, taux: 45 },
        ],
      },
      {
        titre: "Pulvérisation Vers les Bois",
        date: daysAgo(7),
        parcelleNom: "Vers les Bois",
        statut: TravailStatut.VALIDATED,
        interne: false,
        heures: [{ userId: demoUser.id, dureeMinutes: 90, taux: 45 }],
      },
      {
        titre: "Entretien tracteur",
        date: daysAgo(5),
        statut: TravailStatut.DRAFT,
        interne: true,
        heures: [{ userId: adminUser.id, dureeMinutes: 120 }],
      },
      {
        titre: "Semis maïs La Combe",
        date: daysAgo(15),
        parcelleNom: "La Combe",
        statut: TravailStatut.INVOICED,
        interne: false,
        heures: [
          { userId: adminUser.id, dureeMinutes: 360, taux: 85 },
          { userId: demoUser.id, dureeMinutes: 360, taux: 45 },
        ],
      },
      {
        titre: "Formation Suisse-Bilanz",
        date: daysAgo(30),
        statut: TravailStatut.VALIDATED,
        interne: true,
        heures: [{ userId: demoUser.id, dureeMinutes: 480 }],
      },
      {
        titre: "Fauchage Pré du Moulin",
        date: daysAgo(1),
        parcelleNom: "Pré du Moulin",
        statut: TravailStatut.DRAFT,
        interne: false,
        heures: [{ userId: demoUser.id, dureeMinutes: 210, taux: 45 }],
      },
    ];

    for (const t of travauxData) {
      const parcelleId = t.parcelleNom ? parcelleIds[t.parcelleNom] : null;
      await prisma.travail.create({
        data: {
          tenantId: tenant.id,
          titre: t.titre,
          date: t.date,
          statut: t.statut,
          interne: t.interne,
          ...(parcelleId ? { parcelleId } : {}),
          lignesHeure: {
            create: t.heures.map((h) => ({
              userId: h.userId,
              dureeMinutes: h.dureeMinutes,
              ...(h.taux ? { tauxHoraireCHF: h.taux } : {}),
            })),
          },
        },
      });
    }
  }

  console.log(`✓ Démo : 1 tenant + 2 users + ${DEMO_PARCELLES.length} parcelles +`);
  console.log(`         cheptel mixte (~${DEMO_CHEPTEL.reduce((s, c) => s + c.nombre, 0)}) +`);
  console.log(`         6 travaux avec heures réparties`);
  console.log(`  → admin@admin.ch / admin   (OWNER)`);
  console.log(`  → demo@demo.ch / demo      (EMPLOYE)`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  await seedDevTenant();
  await seedDemoTenant();
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
