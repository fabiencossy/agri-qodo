/**
 * Tests de non-régression sur le code PostGIS (création parcelle avec
 * géométrie + endpoint /map + import GeoJSON).
 *
 * Couvre le bug `text = uuid` rencontré le 2026-04-28 : avec un prepared
 * statement Postgres, le cast `WHERE id = $1::uuid` ne fonctionne pas
 * (l'opérateur garde le type prepare-time text). Solution adoptée :
 * `WHERE id::text = $1`. Ces tests garantissent que le code geom marche.
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

const POLYGON_DEMO = {
  type: "Polygon" as const,
  coordinates: [
    [
      [6.4815, 46.5982],
      [6.4868, 46.5979],
      [6.4892, 46.5994],
      [6.4889, 46.6024],
      [6.4828, 46.602],
      [6.4815, 46.5982],
    ],
  ],
};

describe("Parcelles geom (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const user = { email: "geom@m1.test", password: "Password123!" };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.truncateAll();

    const tenant = await prisma.exploitation.create({
      data: { code: "AQ-VD-GEOM", nom: "Ferme geom", canton: Canton.VD },
    });
    await prisma.user.create({
      data: {
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, 10),
        prenom: "G",
        nom: "Test",
        tenantId: tenant.id,
      },
    });

    const login = await request(app.getHttpServer()).post("/api/auth/login").send(user).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("POST /parcelles avec geomGeoJson → géométrie persistée", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/parcelles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nom: "Champ avec geom",
        surfaceM2: 12500,
        zone: "ZA",
        geomGeoJson: POLYGON_DEMO,
      })
      .expect(201);

    expect((created.body as { id: string }).id).toBeDefined();

    // Récupère via /map et vérifie que geom est bien là
    const map = await request(app.getHttpServer())
      .get("/api/parcelles/map")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const list = map.body as Array<{
      id: string;
      nom: string;
      geom: { type: string } | null;
    }>;
    const found = list.find((p) => p.nom === "Champ avec geom");
    expect(found).toBeDefined();
    expect(found?.geom).toBeDefined();
    expect(found?.geom?.type).toBe("MultiPolygon");
  });

  it("POST /parcelles/import avec FeatureCollection → toutes créées avec geom", async () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { nom: "Import 1", zone: "ZA" },
          geometry: POLYGON_DEMO,
        },
        {
          type: "Feature",
          properties: { nom: "Import 2" }, // zone absente → defaultZone
          geometry: POLYGON_DEMO,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post("/api/parcelles/import")
      .set("Authorization", `Bearer ${token}`)
      .send({ featureCollection: fc, defaultZone: "ZP" })
      .expect(201);

    const result = res.body as {
      total: number;
      created: number;
      errors: unknown[];
    };
    expect(result.total).toBe(2);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Vérifie que les 2 parcelles ont bien leur géométrie
    const map = await request(app.getHttpServer())
      .get("/api/parcelles/map")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const list = map.body as Array<{
      nom: string;
      zone: string;
      geom: { type: string } | null;
    }>;
    expect(list.find((p) => p.nom === "Import 1")?.geom?.type).toBe("MultiPolygon");
    expect(list.find((p) => p.nom === "Import 2")?.geom?.type).toBe("MultiPolygon");
    expect(list.find((p) => p.nom === "Import 2")?.zone).toBe("ZP");
  });

  it("POST /parcelles/import refuse un FeatureCollection invalide", async () => {
    await request(app.getHttpServer())
      .post("/api/parcelles/import")
      .set("Authorization", `Bearer ${token}`)
      .send({ featureCollection: { not: "valid" } })
      .expect(400);
  });

  it("POST /parcelles/import refuse un FeatureCollection vide", async () => {
    await request(app.getHttpServer())
      .post("/api/parcelles/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        featureCollection: { type: "FeatureCollection", features: [] },
      })
      .expect(400);
  });
});
