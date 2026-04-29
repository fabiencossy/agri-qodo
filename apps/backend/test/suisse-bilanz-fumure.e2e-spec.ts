/**
 * Tests M3v2 #77/#78 — FUMURE intégrée au Suisse-Bilanz + détail par parcelle.
 *
 * Vérifie que :
 *   - Une intervention FUMURE_MINERALE avec produit (tauxN, tauxP, quantite)
 *     ajoute kgN/kgP au bilan, sur la bonne parcelle.
 *   - Le détail par parcelle remonte apports + besoin + solde.
 *   - Une fumure sans produit ou sans quantité génère un warning.
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton, InterventionType, ProduitCategorie, ZoneAgricole } from "@prisma/client";
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
  soldeN: number;
  details: Array<{
    parcelleId: string;
    parcelleNom: string;
    apportsN: number;
    apportsP: number;
    soldeN: number;
    soldeP: number;
  }>;
  warnings: string[];
}

describe("Suisse-Bilanz M3v2 — FUMURE intégrée + détail par parcelle (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let parcelleAId: string;

  const user = { email: "fumure@m3v2.test", password: "Password123!" };

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
      data: { code: "AQ-VD-FUMURE", nom: "Ferme M3v2 Fumure", canton: Canton.VD },
    });
    await prisma.user.create({
      data: { email: user.email, passwordHash, prenom: "U", nom: "F", tenantId: tenant.id },
    });
    // 1 ha de blé panifiable → besoin 140 kg N
    const parcelleA = await prisma.parcelle.create({
      data: {
        tenantId: tenant.id,
        nom: "Parcelle Fumure",
        surfaceM2: 10_000,
        zone: ZoneAgricole.ZA,
      },
    });
    parcelleAId = parcelleA.id;
    await prisma.culture.create({
      data: {
        tenantId: tenant.id,
        parcelleId: parcelleA.id,
        espece: "ble_panifiable",
        campagne: 2026,
      },
    });
    // Produits engrais : urée (46% N), triple super (45% P), un sans tauxN/P
    await prisma.produit.createMany({
      data: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          code: "test_uree_46",
          categorie: ProduitCategorie.ENGRAIS_MINERAL,
          libelle: "Urée 46% N",
          tauxN: "46",
          tauxP: "0",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          code: "test_triple_super_45",
          categorie: ProduitCategorie.ENGRAIS_MINERAL,
          libelle: "Triple Super 45% P",
          tauxN: "0",
          tauxP: "45",
        },
        {
          id: "33333333-3333-3333-3333-333333333333",
          code: "test_engrais_sans_tauxN",
          categorie: ProduitCategorie.ENGRAIS_MINERAL,
          libelle: "Engrais sans tauxN",
          tauxN: null,
          tauxP: null,
        },
      ],
    });

    const login = await request(app.getHttpServer()).post("/api/auth/login").send(user).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("FUMURE_MINERALE 100 kg d'urée 46% N → 46 kg N au bilan, localisés sur la parcelle", async () => {
    await prisma.intervention.create({
      data: {
        clientUuid: "fumure-uree-2026",
        ownerTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        authorTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        parcelleId: parcelleAId,
        type: InterventionType.FUMURE_MINERALE,
        dateOperation: new Date("2026-03-15"),
        produitId: "11111111-1111-1111-1111-111111111111",
        produit: "Urée 46% N",
        quantite: "100",
        unite: "kg",
      },
    });

    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2026")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const body = res.body as BilanResponse;
    expect(body.apportsN).toBe(46);
    expect(body.besoinsN).toBe(140);
    expect(body.soldeN).toBe(-94);
    const detail = body.details.find((d) => d.parcelleId === parcelleAId);
    expect(detail?.apportsN).toBe(46);
    expect(detail?.soldeN).toBe(-94); // 46 - 140
  });

  it("Détail parcelle remonte besoinN+apportsN+soldeN après plusieurs FUMURE", async () => {
    // Ajout d'un 2e apport : 50 kg de triple super → 22.5 kg P
    await prisma.intervention.create({
      data: {
        clientUuid: "fumure-tsp-2026",
        ownerTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        authorTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        parcelleId: parcelleAId,
        type: InterventionType.FUMURE_MINERALE,
        dateOperation: new Date("2026-04-01"),
        produitId: "22222222-2222-2222-2222-222222222222",
        produit: "Triple Super 45% P",
        quantite: "50",
        unite: "kg",
      },
    });

    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2026")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const body = res.body as BilanResponse;
    expect(body.apportsN).toBe(46); // urée seule
    expect(body.apportsP).toBe(22.5); // triple super seul
    const detail = body.details.find((d) => d.parcelleId === parcelleAId);
    expect(detail?.apportsN).toBe(46);
    expect(detail?.apportsP).toBe(22.5);
  });

  it("FUMURE sans produit → warning + non comptée", async () => {
    await prisma.intervention.create({
      data: {
        clientUuid: "fumure-sans-produit-2026",
        ownerTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        authorTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        parcelleId: parcelleAId,
        type: InterventionType.FUMURE_ORGANIQUE,
        dateOperation: new Date("2026-05-01"),
        // pas de produitId
        produit: "Lisier",
        quantite: "1000",
        unite: "L",
      },
    });

    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2026")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const body = res.body as BilanResponse;
    expect(body.warnings.some((w) => w.includes("sans produit du catalogue"))).toBe(true);
    // Apport reste à 46 (urée), la fumure orpheline n'est pas comptée
    expect(body.apportsN).toBe(46);
  });

  it("FUMURE avec produit mais quantité null → warning + non comptée", async () => {
    await prisma.intervention.create({
      data: {
        clientUuid: "fumure-sans-quantite-2026",
        ownerTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        authorTenantId: (await prisma.exploitation.findFirstOrThrow({})).id,
        parcelleId: parcelleAId,
        type: InterventionType.FUMURE_MINERALE,
        dateOperation: new Date("2026-06-01"),
        produitId: "11111111-1111-1111-1111-111111111111",
        // pas de quantite
      },
    });

    const res = await request(app.getHttpServer())
      .get("/api/suisse-bilanz/2026")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const body = res.body as BilanResponse;
    expect(body.warnings.some((w) => w.includes("sans quantité"))).toBe(true);
  });
});
