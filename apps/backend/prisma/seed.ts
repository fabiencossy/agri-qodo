/**
 * Seed minimal pour le développement local + le compte de démo public.
 *
 * Crée deux exploitations / comptes :
 *   - Compte dev : marie@ferme-rolet.test / DemoPassword123! (Ferme Rolet)
 *   - Compte démo public : test@test.ch / test
 *     (compte simple à partager à des testeurs externes — pas pour la prod)
 *
 * Lancer : `pnpm --filter @agri-qodo/backend exec ts-node prisma/seed.ts`
 */
import { type AnimalCategorie, Canton, PrismaClient, ZoneAgricole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

interface DemoCheptelEntry {
  categorie: AnimalCategorie;
  nombre: number;
}

interface DemoTenant {
  code: string;
  nom: string;
  canton: Canton;
  numeroUfam: string;
  npa: string;
  localite: string;
  emailContact: string;
  user: { email: string; password: string; prenom: string; nom: string };
  parcelles: Array<{
    nom: string;
    surfaceM2: number;
    zone: ZoneAgricole;
    geomGeoJson: string;
    culture?: { espece: string; campagne: number; dateSemis: Date };
  }>;
  cheptel: DemoCheptelEntry[];
}

const DEMO_TENANTS: DemoTenant[] = [
  {
    code: "AQ-VD-1247-DEMO",
    nom: "Ferme de démo (Rolet)",
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
    parcelles: [],
    cheptel: [],
  },
  {
    code: "AQ-VD-DEMO-PUBLIC",
    nom: "Démo Agri Qodo",
    canton: Canton.VD,
    numeroUfam: "0000",
    npa: "1400",
    localite: "Yverdon-les-Bains",
    emailContact: "test@test.ch",
    user: { email: "test@test.ch", password: "test", prenom: "Test", nom: "Demo" },
    // Parcelles dessinées approximativement autour d'Yverdon (vu carte CH).
    // GeoJSON MultiPolygon WGS84.
    parcelles: [
      {
        nom: "Champ du Bas",
        surfaceM2: 38_400,
        zone: ZoneAgricole.ZA,
        geomGeoJson: JSON.stringify({
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [6.6342, 46.7782],
                [6.6378, 46.7782],
                [6.6383, 46.7798],
                [6.6346, 46.78],
                [6.6342, 46.7782],
              ],
            ],
          ],
        }),
        culture: {
          espece: "ble_panifiable",
          campagne: 2026,
          dateSemis: new Date("2025-10-12"),
        },
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
                [6.6395, 46.777],
                [6.642, 46.7771],
                [6.6422, 46.7785],
                [6.6398, 46.7787],
                [6.6395, 46.777],
              ],
            ],
          ],
        }),
        culture: {
          espece: "prairie_temporaire",
          campagne: 2026,
          dateSemis: new Date("2025-04-15"),
        },
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
                [6.631, 46.7755],
                [6.636, 46.7752],
                [6.6365, 46.777],
                [6.6315, 46.7773],
                [6.631, 46.7755],
              ],
            ],
          ],
        }),
        culture: {
          espece: "mais_ensilage",
          campagne: 2026,
          dateSemis: new Date("2026-04-22"),
        },
      },
    ],
    cheptel: [
      { categorie: "VACHE_LAITIERE", nombre: 28 },
      { categorie: "GENISSE", nombre: 12 },
      { categorie: "VEAU", nombre: 6 },
    ],
  },
];

async function seedTenant(t: DemoTenant): Promise<void> {
  const tenant = await prisma.exploitation.upsert({
    where: { code: t.code },
    update: {},
    create: {
      code: t.code,
      nom: t.nom,
      canton: t.canton,
      numeroUfam: t.numeroUfam,
      npa: t.npa,
      localite: t.localite,
      emailContact: t.emailContact,
    },
  });

  const passwordHash = await bcrypt.hash(t.user.password, 10);
  await prisma.user.upsert({
    where: { email: t.user.email },
    update: {},
    create: {
      email: t.user.email,
      passwordHash,
      prenom: t.user.prenom,
      nom: t.user.nom,
      role: "OWNER",
      tenantId: tenant.id,
    },
  });

  for (const p of t.parcelles) {
    // Idempotence : on cherche par (tenantId, nom) pour éviter doublons à
    // chaque relance.
    const existing = await prisma.parcelle.findFirst({
      where: { tenantId: tenant.id, nom: p.nom },
    });
    if (existing) continue;
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
    if (parcelleId && p.culture) {
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

  for (const c of t.cheptel) {
    const already = await prisma.animal.count({
      where: { tenantId: tenant.id, categorie: c.categorie },
    });
    const todo = c.nombre - already;
    if (todo <= 0) continue;
    await prisma.animal.createMany({
      data: Array.from({ length: todo }, () => ({
        tenantId: tenant.id,
        categorie: c.categorie,
      })),
    });
  }

  console.log(`Seed OK : ${tenant.code} → ${t.user.email} / ${t.user.password}`);
}

async function main(): Promise<void> {
  for (const t of DEMO_TENANTS) {
    await seedTenant(t);
  }
  console.log(
    `Code aléatoire pour info : AQ-VD-1247-${randomBytes(2).toString("hex").toUpperCase()}`,
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
