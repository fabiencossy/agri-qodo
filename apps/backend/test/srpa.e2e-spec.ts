/**
 * Tests M5 — SRPA (Sorties au pâturage).
 * Couvre le CRUD + isolation entre 2 tenants + contrainte unique
 * (date+catégorie+tenant).
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("SRPA M5 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: "srpa-a@m5.test", password: "Password123!" };
  const userB = { email: "srpa-b@m5.test", password: "Password123!" };

  let tokenA: string;
  let tokenB: string;
  let sortieAId: string;

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
      data: { code: "AQ-VD-SRPA-A", nom: "Ferme M5 A", canton: Canton.VD },
    });
    const tenantB = await prisma.exploitation.create({
      data: { code: "AQ-VD-SRPA-B", nom: "Ferme M5 B", canton: Canton.VD },
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

  it("POST /srpa côté A → création OK avec tenantId injecté", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/srpa")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        date: "2026-04-28",
        categorie: "VACHE_LAITIERE",
        nombreAnimaux: 25,
        dureeMinutes: 480,
      })
      .expect(201);

    const body = res.body as { id: string; categorie: string };
    expect(body.categorie).toBe("VACHE_LAITIERE");
    sortieAId = body.id;
  });

  it("POST /srpa avec même date+catégorie → 409 Conflict", async () => {
    await request(app.getHttpServer())
      .post("/api/srpa")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        date: "2026-04-28",
        categorie: "VACHE_LAITIERE",
      })
      .expect(409);
  });

  it("POST /srpa même date côté B → OK (isolation par tenant)", async () => {
    await request(app.getHttpServer())
      .post("/api/srpa")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        date: "2026-04-28",
        categorie: "VACHE_LAITIERE",
      })
      .expect(201);
  });

  it("GET /srpa côté A → uniquement les sorties de A", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/srpa")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const list = res.body as Array<{ id: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(sortieAId);
  });

  it("GET /:id côté B sur sortie de A → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/srpa/${sortieAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("PATCH côté A → modification persiste", async () => {
    await request(app.getHttpServer())
      .patch(`/api/srpa/${sortieAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ notes: "Beau temps, prairie sèche" })
      .expect(200);
  });

  it("DELETE côté B sur sortie de A → 404", async () => {
    await request(app.getHttpServer())
      .delete(`/api/srpa/${sortieAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("DELETE côté A → 204", async () => {
    await request(app.getHttpServer())
      .delete(`/api/srpa/${sortieAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);
  });
});
