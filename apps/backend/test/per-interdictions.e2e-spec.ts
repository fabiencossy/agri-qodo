/**
 * Tests M3v6 — Endpoint /api/per/check-fumure-organique.
 *
 * Vérifie que :
 *   - Une date hors période d'interdiction → autorisée
 *   - Une date pendant interdiction hivernale (ZA, déc) → interdite + raison
 *   - Parcelle d'un autre tenant → 404
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton, ZoneAgricole } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("PER M3v6 — Calendrier interdictions fumure organique (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let parcelleZAId: string;
  let parcelleZM4Id: string;
  let parcelleAutreTenantId: string;

  const user = { email: "per@m3v6.test", password: "Password123!" };

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
      data: { code: "AQ-VD-PER", nom: "Ferme PER", canton: Canton.VD },
    });
    await prisma.user.create({
      data: { email: user.email, passwordHash, prenom: "U", nom: "P", tenantId: tenant.id },
    });
    const za = await prisma.parcelle.create({
      data: { tenantId: tenant.id, nom: "ZA", surfaceM2: 10000, zone: ZoneAgricole.ZA },
    });
    const zm4 = await prisma.parcelle.create({
      data: { tenantId: tenant.id, nom: "ZM4", surfaceM2: 5000, zone: ZoneAgricole.ZM4 },
    });
    parcelleZAId = za.id;
    parcelleZM4Id = zm4.id;

    // Tenant tiers + parcelle
    const autre = await prisma.exploitation.create({
      data: { code: "AQ-VD-PER-AUTRE", nom: "Autre", canton: Canton.VD },
    });
    const autreParcelle = await prisma.parcelle.create({
      data: { tenantId: autre.id, nom: "Autre", surfaceM2: 5000, zone: ZoneAgricole.ZA },
    });
    parcelleAutreTenantId = autreParcelle.id;

    const login = await request(app.getHttpServer()).post("/api/auth/login").send(user).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("ZA Plateau, 1er décembre → interdit", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/per/check-fumure-organique?parcelleId=${parcelleZAId}&date=2026-12-01`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const body = res.body as { interdit: boolean; raison: string | null };
    expect(body.interdit).toBe(true);
    expect(body.raison).toMatch(/hivernale/i);
  });

  it("ZA Plateau, 15 mars → autorisé", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/per/check-fumure-organique?parcelleId=${parcelleZAId}&date=2026-03-15`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect((res.body as { interdit: boolean }).interdit).toBe(false);
  });

  it("ZM4 Montagne IV, 1er avril → encore interdit (fin 15-04)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/per/check-fumure-organique?parcelleId=${parcelleZM4Id}&date=2026-04-01`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect((res.body as { interdit: boolean }).interdit).toBe(true);
  });

  it("Parcelle d'un autre tenant → 404", async () => {
    await request(app.getHttpServer())
      .get(`/api/per/check-fumure-organique?parcelleId=${parcelleAutreTenantId}&date=2026-12-01`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("Sans token → 401", async () => {
    await request(app.getHttpServer())
      .get(`/api/per/check-fumure-organique?parcelleId=${parcelleZAId}&date=2026-12-01`)
      .expect(401);
  });

  it("Date invalide → 400", async () => {
    await request(app.getHttpServer())
      .get(`/api/per/check-fumure-organique?parcelleId=${parcelleZAId}&date=not-a-date`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });
});
