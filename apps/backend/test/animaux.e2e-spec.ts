/**
 * Tests M4 — Animaux.
 * CRUD individuel + saisie batch + endpoint categories-actives + isolation tenant.
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("Animaux M4 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: "animaux-a@m4.test", password: "Password123!" };
  const userB = { email: "animaux-b@m4.test", password: "Password123!" };

  let tokenA: string;
  let tokenB: string;
  let animalAId: string;

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
      data: { code: "AQ-VD-ANM-A", nom: "Ferme M4 A", canton: Canton.VD },
    });
    const tenantB = await prisma.exploitation.create({
      data: { code: "AQ-VD-ANM-B", nom: "Ferme M4 B", canton: Canton.VD },
    });
    await prisma.user.createMany({
      data: [
        { email: userA.email, passwordHash, prenom: "U", nom: "A", tenantId: tenantA.id },
        { email: userB.email, passwordHash, prenom: "U", nom: "B", tenantId: tenantB.id },
      ],
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

  it("POST /api/animaux côté A → crée un animal individuel", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/animaux")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        categorie: "VACHE_LAITIERE",
        nom: "Marguerite",
        numeroBoucle: "CH 120 1234 5678 1",
      })
      .expect(201);
    const body = res.body as { id: string; categorie: string };
    expect(body.categorie).toBe("VACHE_LAITIERE");
    animalAId = body.id;
  });

  it("POST /api/animaux/batch → crée 50 porcs en une fois", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/animaux/batch")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ categorie: "PORC", nombre: 50 })
      .expect(201);
    expect(res.body).toEqual({ created: 50, categorie: "PORC" });
  });

  it("GET /api/animaux/summary côté A → 1 vache + 50 porcs", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/animaux/summary")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const body = res.body as Array<{ categorie: string; nombreActifs: number }>;
    expect(body).toHaveLength(2);
    expect(body.find((b) => b.categorie === "VACHE_LAITIERE")?.nombreActifs).toBe(1);
    expect(body.find((b) => b.categorie === "PORC")?.nombreActifs).toBe(50);
  });

  it("GET /api/animaux/categories-actives côté A → ['PORC', 'VACHE_LAITIERE']", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/animaux/categories-actives")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const body = res.body as string[];
    expect(body.sort()).toEqual(["PORC", "VACHE_LAITIERE"]);
  });

  it("GET /api/animaux/categories-actives côté B → [] (isolation)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/animaux/categories-actives")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("POST /api/animaux avec même n° boucle → 409", async () => {
    await request(app.getHttpServer())
      .post("/api/animaux")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        categorie: "VACHE_LAITIERE",
        numeroBoucle: "CH 120 1234 5678 1",
      })
      .expect(409);
  });

  it("GET /api/animaux/:id côté B sur animal de A → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/animaux/${animalAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("DELETE /api/animaux/batch?categorie=PORC&nombre=10 → 10 porcs supprimés", async () => {
    const res = await request(app.getHttpServer())
      .delete("/api/animaux/batch?categorie=PORC&nombre=10")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body).toEqual({ deleted: 10 });

    const summary = await request(app.getHttpServer())
      .get("/api/animaux/summary")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const porcs = (summary.body as Array<{ categorie: string; nombreActifs: number }>).find(
      (b) => b.categorie === "PORC",
    );
    expect(porcs?.nombreActifs).toBe(40);
  });

  it("PATCH côté A → marque animal inactif", async () => {
    await request(app.getHttpServer())
      .patch(`/api/animaux/${animalAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ isActive: false })
      .expect(200);

    const cats = await request(app.getHttpServer())
      .get("/api/animaux/categories-actives")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(cats.body).toEqual(["PORC"]); // VACHE_LAITIERE retirée car 0 actif
  });

  it("DELETE côté B sur animal de A → 404 (isolation)", async () => {
    await request(app.getHttpServer())
      .delete(`/api/animaux/${animalAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });
});
