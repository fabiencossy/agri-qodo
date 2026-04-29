/**
 * Tests M3 — Suisse-Bilanz endpoint /api/suisse-bilanz/:annee.
 * Couvre : agrégation cultures + animaux, isolation tenant, warnings.
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AnimalCategorie, Canton, ZoneAgricole } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

interface BilanResponse {
  annee: number;
  apportsN: number;
  apportsP: number;
  besoinsN: number;
  besoinsP: number;
  soldeN: number;
  soldeP: number;
  conformeN: boolean;
  conformeP: boolean;
  details: Array<{
    parcelleId: string;
    parcelleNom: string;
    espece: string;
    surfaceHa: number;
    besoinN: number;
    besoinP: number;
    apportsN: number;
    apportsP: number;
    soldeN: number;
    soldeP: number;
  }>;
  warnings: string[];
}

describe("Suisse-Bilanz M3 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: "bilanz-a@m3.test", password: "Password123!" };
  const userB = { email: "bilanz-b@m3.test", password: "Password123!" };

  let tokenA: string;
  let tokenB: string;

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
      data: { code: "AQ-VD-BILANZ-A", nom: "Ferme M3 A", canton: Canton.VD },
    });
    const tenantB = await prisma.exploitation.create({
      data: { code: "AQ-VD-BILANZ-B", nom: "Ferme M3 B", canton: Canton.VD },
    });

    await prisma.user.createMany({
      data: [
        { email: userA.email, passwordHash, prenom: "U", nom: "A", tenantId: tenantA.id },
        { email: userB.email, passwordHash, prenom: "U", nom: "B", tenantId: tenantB.id },
      ],
    });

    // Tenant A : 10 ha de blé panifiable + 5 vaches laitières (campagne 2026)
    const parcelleA = await prisma.parcelle.create({
      data: {
        tenantId: tenantA.id,
        nom: "Champ A1",
        surfaceM2: 100_000,
        zone: ZoneAgricole.ZA,
      },
    });
    await prisma.culture.create({
      data: {
        tenantId: tenantA.id,
        parcelleId: parcelleA.id,
        espece: "ble_panifiable",
        campagne: 2026,
      },
    });
    await prisma.animal.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        tenantId: tenantA.id,
        nom: `Vache${i}`,
        categorie: AnimalCategorie.VACHE_LAITIERE,
        isActive: true,
      })),
    });

    // Tenant B : 1 ha colza, 100 porcs (chiffres très différents)
    const parcelleB = await prisma.parcelle.create({
      data: {
        tenantId: tenantB.id,
        nom: "Champ B1",
        surfaceM2: 10_000,
        zone: ZoneAgricole.ZA,
      },
    });
    await prisma.culture.create({
      data: {
        tenantId: tenantB.id,
        parcelleId: parcelleB.id,
        espece: "colza",
        campagne: 2026,
      },
    });
    await prisma.animal.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        tenantId: tenantB.id,
        nom: `Porc${i}`,
        categorie: AnimalCategorie.PORC,
        isActive: true,
      })),
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

  it("GET /api/suisse-bilanz/2026 sans token → 401", async () => {
    await request(app.getHttpServer()).get("/api/suisse-bilanz/2026").expect(401);
  });

  it("GET /api/suisse-bilanz/abc → 400 (param non-int)", async () => {
    await request(app.getHttpServer())
      .get("/api/suisse-bilanz/abc")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(400);
  });

  it("GET /api/suisse-bilanz/2026 côté A → calcul agrégé sur cultures+cheptel A", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2026")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const body = res.body as BilanResponse;
    // 10 ha × 140 kg N/ha = 1400 kg N besoin
    expect(body.besoinsN).toBe(1400);
    // 5 vaches × 1.0 UGB × 105 kg N/UGB = 525 (déjections)
    // + 10 ha × 20 kg N/ha (atmo) = 200 → total 725
    expect(body.apportsN).toBe(725);
    expect(body.soldeN).toBe(-675);
    expect(body.conformeN).toBe(true);
    expect(body.details).toHaveLength(1);
    expect(body.details[0]?.parcelleNom).toBe("Champ A1");
  });

  it("GET côté B → ne voit que ses propres données (isolation)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2026")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    const body = res.body as BilanResponse;
    // 1 ha × 130 kg N/ha = 130 kg N besoin
    expect(body.besoinsN).toBe(130);
    // 100 porcs × 0.15 UGB × 90 kg N/UGB = 1350 + atmo (1 ha × 20) = 1370
    expect(body.apportsN).toBe(1370);
    expect(body.soldeN).toBe(1240); // surfertilisation
    expect(body.conformeN).toBe(false);
    expect(body.details).toHaveLength(1);
    expect(body.details[0]?.parcelleNom).toBe("Champ B1");
  });

  it("GET /api/suisse-bilanz/2024 (sans données) → bilan vide conforme", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2024")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const body = res.body as BilanResponse;
    expect(body.besoinsN).toBe(0);
    expect(body.apportsN).toBe(525); // les vaches sont actuelles, pas filtrées par année
    expect(body.details).toHaveLength(0);
  });
});
