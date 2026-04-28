/**
 * Tests M2 — Carnet des champs.
 * Couvre le CRUD interventions + l'isolation entre 2 tenants
 * (Intervention a 2 fields tenant : ownerTenantId + authorTenantId,
 * géré manuellement dans le service — pas de filtrage auto Prisma).
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton, ZoneAgricole } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("Interventions M2 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: "iv-a@m2.test", password: "Password123!" };
  const userB = { email: "iv-b@m2.test", password: "Password123!" };

  let parcelleAId: string;
  let parcelleBId: string;
  let tokenA: string;
  let tokenB: string;
  let interventionAId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.truncateAll();

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const tenantA = await prisma.exploitation.create({
      data: { code: "AQ-VD-IV-A", nom: "Ferme M2 A", canton: Canton.VD },
    });
    const tenantB = await prisma.exploitation.create({
      data: { code: "AQ-VD-IV-B", nom: "Ferme M2 B", canton: Canton.VD },
    });
    await prisma.user.create({
      data: {
        email: userA.email,
        passwordHash,
        prenom: "U",
        nom: "A",
        tenantId: tenantA.id,
      },
    });
    await prisma.user.create({
      data: {
        email: userB.email,
        passwordHash,
        prenom: "U",
        nom: "B",
        tenantId: tenantB.id,
      },
    });
    const parcelleA = await prisma.parcelle.create({
      data: {
        tenantId: tenantA.id,
        nom: "P-A",
        surfaceM2: 10000,
        zone: ZoneAgricole.ZA,
      },
    });
    const parcelleB = await prisma.parcelle.create({
      data: {
        tenantId: tenantB.id,
        nom: "P-B",
        surfaceM2: 10000,
        zone: ZoneAgricole.ZA,
      },
    });
    parcelleAId = parcelleA.id;
    parcelleBId = parcelleB.id;

    const loginA = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send(userA)
      .expect(200);
    tokenA = (loginA.body as { accessToken: string }).accessToken;
    const loginB = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send(userB)
      .expect(200);
    tokenB = (loginB.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("POST côté A → owner=A, author=A, validationStatus=SELF", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        parcelleId: parcelleAId,
        type: "PHYTO",
        dateOperation: "2026-04-28",
        produit: "Roundup MAX 360",
        quantite: 25.5,
        unite: "L",
      })
      .expect(201);

    const body = res.body as {
      id: string;
      ownerTenantId: string;
      authorTenantId: string;
      validationStatus: string;
      parcelle: { nom: string };
    };
    expect(body.ownerTenantId).toBe(body.authorTenantId);
    expect(body.validationStatus).toBe("SELF");
    expect(body.parcelle.nom).toBe("P-A");
    interventionAId = body.id;
  });

  it("POST côté A avec parcelleId de B → 403 (parcelle hors scope)", async () => {
    await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        parcelleId: parcelleBId,
        type: "SEMIS",
        dateOperation: "2026-04-28",
      })
      .expect(403);
  });

  it("GET /api/interventions côté A → uniquement les siennes", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/interventions")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const list = res.body as Array<{ id: string; ownerTenantId: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(interventionAId);
  });

  it("GET /api/interventions côté B → liste vide", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/interventions")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("GET /:id côté B sur intervention de A → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("PATCH côté B sur intervention de A → 404 (et pas modifiée)", async () => {
    await request(app.getHttpServer())
      .patch(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ produit: "Hacké" })
      .expect(404);

    const verif = await request(app.getHttpServer())
      .get(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect((verif.body as { produit: string }).produit).toBe("Roundup MAX 360");
  });

  it("PATCH côté A → 200 et modifie", async () => {
    await request(app.getHttpServer())
      .patch(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ notes: "Vent faible, conditions OK" })
      .expect(200);

    const verif = await request(app.getHttpServer())
      .get(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect((verif.body as { notes: string }).notes).toBe("Vent faible, conditions OK");
  });

  it("DELETE côté B sur intervention de A → 404", async () => {
    await request(app.getHttpServer())
      .delete(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
  });

  it("DELETE côté A → 204 puis 404 sur GET", async () => {
    await request(app.getHttpServer())
      .delete(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/interventions/${interventionAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404);
  });
});
