/**
 * Tests M3v2 — Carnet = source unique : SEMIS crée Culture auto.
 *
 * Vérifie que :
 *   - Un SEMIS avec produit SEMENCE → Culture auto-créée (espece, variete,
 *     dateSemis, campagne) et liée via cultureId.
 *   - Modifier la dateOperation d'un SEMIS → propage à la Culture.
 *   - Supprimer le SEMIS → supprime la Culture liée.
 *   - Erreurs métier (mauvaise catégorie, especeCode manquant).
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton, ProduitCategorie, ZoneAgricole } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("Interventions M3v2 — SEMIS crée Culture (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const user = { email: "semis@m3v2.test", password: "Password123!" };
  let token: string;
  let parcelleId: string;
  let semenceId: string;
  let semenceSansEspeceId: string;
  let engraisId: string;

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
      data: { code: "AQ-VD-M3V2", nom: "Ferme M3v2", canton: Canton.VD },
    });
    await prisma.user.create({
      data: { email: user.email, passwordHash, prenom: "U", nom: "M3", tenantId: tenant.id },
    });
    const parcelle = await prisma.parcelle.create({
      data: { tenantId: tenant.id, nom: "P-M3V2", surfaceM2: 10000, zone: ZoneAgricole.ZA },
    });
    parcelleId = parcelle.id;

    // Catalogue : 3 produits globaux pour les tests
    const semence = await prisma.produit.create({
      data: {
        categorie: ProduitCategorie.SEMENCE,
        code: "test_ble_bodeli",
        libelle: "Blé Bodeli",
        especeCode: "ble_panifiable",
      },
    });
    semenceId = semence.id;
    const semenceSansEspece = await prisma.produit.create({
      data: {
        categorie: ProduitCategorie.SEMENCE,
        code: "test_semence_orpheline",
        libelle: "Semence sans code",
        especeCode: null,
      },
    });
    semenceSansEspeceId = semenceSansEspece.id;
    const engrais = await prisma.produit.create({
      data: {
        categorie: ProduitCategorie.ENGRAIS_MINERAL,
        code: "test_landor_n",
        libelle: "Landor Nitrate",
      },
    });
    engraisId = engrais.id;

    const login = await request(app.getHttpServer()).post("/api/auth/login").send(user).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("SEMIS avec produit SEMENCE → Culture créée et liée", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        type: "SEMIS",
        dateOperation: "2026-10-15",
        produitId: semenceId,
      })
      .expect(201);

    const body = res.body as {
      id: string;
      cultureId: string;
      produitId: string;
      culture: { espece: string; variete: string; campagne: number };
    };
    expect(body.cultureId).toBeTruthy();
    expect(body.produitId).toBe(semenceId);
    expect(body.culture.espece).toBe("ble_panifiable");
    expect(body.culture.variete).toBe("Blé Bodeli");
    expect(body.culture.campagne).toBe(2026);
  });

  it("SEMIS sans produitId → pas de Culture (intervention quand même créée)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({ parcelleId, type: "SEMIS", dateOperation: "2026-10-16" })
      .expect(201);
    const body = res.body as { cultureId: string | null };
    expect(body.cultureId).toBeNull();
  });

  it("SEMIS avec produit ENGRAIS → 400 (mauvaise catégorie)", async () => {
    await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({ parcelleId, type: "SEMIS", dateOperation: "2026-10-17", produitId: engraisId })
      .expect(400);
  });

  it("SEMIS avec semence sans especeCode → 400", async () => {
    await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        type: "SEMIS",
        dateOperation: "2026-10-18",
        produitId: semenceSansEspeceId,
      })
      .expect(400);
  });

  it("PHYTO avec produit SEMENCE → ok mais pas de Culture créée", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({ parcelleId, type: "PHYTO", dateOperation: "2026-04-28", produitId: semenceId })
      .expect(201);
    const body = res.body as { cultureId: string | null };
    expect(body.cultureId).toBeNull();
  });

  it("PATCH dateOperation sur SEMIS → propage dateSemis et campagne", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        type: "SEMIS",
        dateOperation: "2026-10-20",
        produitId: semenceId,
      })
      .expect(201);
    const interventionId = (created.body as { id: string }).id;
    const cultureId = (created.body as { cultureId: string }).cultureId;

    await request(app.getHttpServer())
      .patch(`/api/interventions/${interventionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dateOperation: "2027-03-15" })
      .expect(200);

    const culture = await prisma.culture.findUniqueOrThrow({ where: { id: cultureId } });
    expect(culture.campagne).toBe(2027);
    expect(culture.dateSemis?.getUTCFullYear()).toBe(2027);
  });

  it("DELETE intervention SEMIS → Culture supprimée aussi", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/interventions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        parcelleId,
        type: "SEMIS",
        dateOperation: "2026-10-25",
        produitId: semenceId,
      })
      .expect(201);
    const interventionId = (created.body as { id: string }).id;
    const cultureId = (created.body as { cultureId: string }).cultureId;

    await request(app.getHttpServer())
      .delete(`/api/interventions/${interventionId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const culture = await prisma.culture.findUnique({ where: { id: cultureId } });
    expect(culture).toBeNull();
  });
});
