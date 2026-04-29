/**
 * Tests M3v5 — Plan de fumure prévisionnel.
 *
 * Vérifie que :
 *   - On peut planifier un apport prévu sur une parcelle/campagne
 *   - kgN/kgP sont calculés auto si produitId fourni
 *   - "Réaliser" un plan crée une Intervention liée
 *   - Update et delete sont bloqués si déjà réalisé
 *   - Isolation tenant
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton, ProduitCategorie, ZoneAgricole } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("Plan de fumure M3v5 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let parcelleId: string;
  const user = { email: "plan@m3v5.test", password: "Password123!" };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.truncateAll();

    const passwordHash = await bcrypt.hash(user.password, 10);
    const tenant = await prisma.exploitation.create({
      data: { code: "AQ-VD-PLAN", nom: "Ferme Plan", canton: Canton.VD },
    });
    await prisma.user.create({
      data: { email: user.email, passwordHash, prenom: "U", nom: "P", tenantId: tenant.id },
    });
    const parcelle = await prisma.parcelle.create({
      data: { tenantId: tenant.id, nom: "Parcelle Plan", surfaceM2: 10_000, zone: ZoneAgricole.ZA },
    });
    parcelleId = parcelle.id;
    await prisma.produit.create({
      data: {
        id: "aaaa1111-aaaa-1111-aaaa-111111111111",
        code: "test_uree_plan",
        categorie: ProduitCategorie.ENGRAIS_MINERAL,
        libelle: "Urée 46% N",
        tauxN: "46",
        tauxP: "0",
      },
    });

    const login = await request(app.getHttpServer()).post("/api/auth/login").send(user).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("POST /api/plan-fumure → calcule kgN auto depuis produit + quantité", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/plan-fumure")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        campagne: 2026,
        datePrevue: "2026-03-15",
        produitId: "aaaa1111-aaaa-1111-aaaa-111111111111",
        quantitePrevue: 100,
        unite: "kg",
      })
      .expect(201);
    const body = res.body as {
      id: string;
      kgNPrevu: string | null;
      kgPPrevu: string | null;
      interventionId: string | null;
    };
    // 100 × 46 / 100 = 46 kg N auto
    expect(Number(body.kgNPrevu)).toBe(46);
    expect(body.interventionId).toBeNull();
  });

  it("GET /api/plan-fumure?campagne=2026 → liste les plans", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/plan-fumure?campagne=2026")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect((res.body as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/plan-fumure/:id/realiser → crée l'Intervention liée", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/plan-fumure")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        campagne: 2026,
        produitId: "aaaa1111-aaaa-1111-aaaa-111111111111",
        quantitePrevue: 50,
        unite: "kg",
      })
      .expect(201);
    const planId = (created.body as { id: string }).id;

    const realised = await request(app.getHttpServer())
      .post(`/api/plan-fumure/${planId}/realiser`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dateOperation: "2026-04-10" })
      .expect(201);
    const body = realised.body as { interventionId: string; intervention: { type: string } };
    expect(body.interventionId).toBeTruthy();
    expect(body.intervention.type).toBe("FUMURE_MINERALE");

    // Vérifie qu'une intervention a bien été créée
    const ivs = await request(app.getHttpServer())
      .get("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const list = ivs.body as Array<{ id: string; produit: string | null }>;
    expect(list.find((i) => i.id === body.interventionId)).toBeTruthy();
  });

  it("PATCH d'un plan déjà réalisé → 400", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/plan-fumure")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        campagne: 2026,
        produitId: "aaaa1111-aaaa-1111-aaaa-111111111111",
        quantitePrevue: 30,
        unite: "kg",
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/plan-fumure/${id}/realiser`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/plan-fumure/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Tentative" })
      .expect(400);
  });

  it("DELETE plan non réalisé → 204", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/plan-fumure")
      .set("Authorization", `Bearer ${token}`)
      .send({ parcelleId, campagne: 2026, produitLibre: "Test à supprimer" })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .delete(`/api/plan-fumure/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });

  it("Isolation : un autre tenant ne voit pas les plans", async () => {
    const other = { email: "other@m3v5.test", password: "Password123!" };
    const passwordHash = await bcrypt.hash(other.password, 10);
    const tenantOther = await prisma.exploitation.create({
      data: { code: "AQ-VD-OTHER", nom: "Autre", canton: Canton.VD },
    });
    await prisma.user.create({
      data: {
        email: other.email,
        passwordHash,
        prenom: "O",
        nom: "T",
        tenantId: tenantOther.id,
      },
    });
    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send(other)
      .expect(200);
    const tokenOther = (login.body as { accessToken: string }).accessToken;
    const res = await request(app.getHttpServer())
      .get("/api/plan-fumure")
      .set("Authorization", `Bearer ${tokenOther}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
