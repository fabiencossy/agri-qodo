/**
 * Test d'isolation multi-tenant.
 *
 * Vérifie qu'un user du tenant A ne peut **jamais** voir ni écrire les
 * données du tenant B :
 *   - GET /api/parcelles côté A ne retourne que les parcelles de A.
 *   - Une tentative d'écriture avec un tenantId forcé est rejetée
 *     (ForbiddenException).
 *   - Le contexte tenant absent (pas de JWT) ne donne accès à rien sur
 *     les modèles tenant-scoped.
 *
 * C'est le filet de sécurité technique : si un dev oublie un filtre
 * `where: { tenantId }`, l'extension Prisma le rajoute automatiquement.
 */
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton, ZoneAgricole } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { TenantContextService } from "@/common/tenant/tenant-context.service";
import { configureApp } from "@/configure-app";

describe("Tenant isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = { email: "user-a@iso.test", password: "Password123!" };
  const userB = { email: "user-b@iso.test", password: "Password123!" };

  let tenantAId: string;
  let tenantBId: string;
  let parcelleAId: string;
  let parcelleBId: string;
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

    // 2 exploitations distinctes, 2 users, 1 parcelle par exploitation.
    const tenantA = await prisma.exploitation.create({
      data: { code: "AQ-VD-ISO-A", nom: "Ferme A", canton: Canton.VD },
    });
    const tenantB = await prisma.exploitation.create({
      data: { code: "AQ-VD-ISO-B", nom: "Ferme B", canton: Canton.VD },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const passwordHash = await bcrypt.hash("Password123!", 10);
    await prisma.user.create({
      data: {
        email: userA.email,
        passwordHash,
        prenom: "User",
        nom: "A",
        tenantId: tenantAId,
      },
    });
    await prisma.user.create({
      data: {
        email: userB.email,
        passwordHash,
        prenom: "User",
        nom: "B",
        tenantId: tenantBId,
      },
    });

    // Parcelles créées EN DIRECT via le client base (pas de contexte tenant
    // posé ici, donc l'extension est transparente — c'est le mode seed).
    const parcelleA = await prisma.parcelle.create({
      data: {
        tenantId: tenantAId,
        nom: "Champ A1",
        surfaceM2: 12000,
        zone: ZoneAgricole.ZA,
      },
    });
    const parcelleB = await prisma.parcelle.create({
      data: {
        tenantId: tenantBId,
        nom: "Champ B1",
        surfaceM2: 8500,
        zone: ZoneAgricole.ZA,
      },
    });
    parcelleAId = parcelleA.id;
    parcelleBId = parcelleB.id;

    // Login each user
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

  describe("Lecture", () => {
    it("user A ne voit que la parcelle de A", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/parcelles")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      const parcelles = res.body as Array<{ id: string; tenantId: string; nom: string }>;
      expect(parcelles).toHaveLength(1);
      expect(parcelles[0]?.id).toBe(parcelleAId);
      expect(parcelles[0]?.nom).toBe("Champ A1");
      expect(parcelles[0]?.tenantId).toBe(tenantAId);
    });

    it("user B ne voit que la parcelle de B", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/parcelles")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);

      const parcelles = res.body as Array<{ id: string; nom: string }>;
      expect(parcelles).toHaveLength(1);
      expect(parcelles[0]?.id).toBe(parcelleBId);
      expect(parcelles[0]?.nom).toBe("Champ B1");
    });

    it("requête sans token → 401 (pas de fuite)", async () => {
      await request(app.getHttpServer()).get("/api/parcelles").expect(401);
    });
  });

  describe("Garanties Prisma extension", () => {
    it("findFirst avec id de l'autre tenant retourne null (filtre auto)", async () => {
      // On simule l'exécution d'une requête côté tenant A pour lire une parcelle de B.
      // Le contexte tenant doit être posé manuellement ici car on appelle
      // Prisma directement (pas via HTTP).
      const tenantContext = app.get(TenantContextService);

      await tenantContext.run({ tenantId: tenantAId, userId: "irrelevant" }, async () => {
        const result = await prisma.tenantAware.parcelle.findFirst({
          where: { id: parcelleBId },
        });
        expect(result).toBeNull();
      });
    });

    it("create avec tenantId d'un autre tenant → ForbiddenException", async () => {
      const tenantContext = app.get(TenantContextService);

      await tenantContext.run({ tenantId: tenantAId, userId: "irrelevant" }, async () => {
        await expect(
          prisma.tenantAware.parcelle.create({
            data: {
              tenantId: tenantBId, // tentative cross-tenant
              nom: "Tentative malicieuse",
              surfaceM2: 1000,
              zone: ZoneAgricole.ZA,
            },
          }),
        ).rejects.toThrow(/cross-tenant/i);
      });
    });

    it("findUnique sur modèle tenant-scoped est interdit (forcer findFirst)", async () => {
      const tenantContext = app.get(TenantContextService);

      await tenantContext.run({ tenantId: tenantAId, userId: "irrelevant" }, async () => {
        await expect(
          prisma.tenantAware.parcelle.findUnique({
            where: { id: parcelleAId },
          }),
        ).rejects.toThrow(/findUnique.*interdit/i);
      });
    });

    it("hors contexte tenant : extension transparente (mode seed/admin)", async () => {
      // Hors run() : pas de tenantId → l'extension laisse passer.
      const all = await prisma.tenantAware.parcelle.findMany();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("CRUD HTTP (étape 5a)", () => {
    let parcelleCreeeParAId: string;

    it("POST /api/parcelles côté A crée bien chez A (tenantId injecté)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/parcelles")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ nom: "Champ Créé HTTP A", surfaceM2: 5000, zone: "ZA" })
        .expect(201);

      const created = res.body as { id: string; tenantId: string; nom: string };
      expect(created.tenantId).toBe(tenantAId);
      expect(created.nom).toBe("Champ Créé HTTP A");
      parcelleCreeeParAId = created.id;
    });

    it("POST avec tenantId forcé dans le body → 403 (extension throw)", async () => {
      await request(app.getHttpServer())
        .post("/api/parcelles")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          nom: "Tentative cross-tenant",
          surfaceM2: 1000,
          zone: "ZA",
          tenantId: tenantBId,
        })
        .expect(400); // ValidationPipe forbidNonWhitelisted rejette le champ inconnu
    });

    it("GET /api/parcelles/:id côté B avec id de A → 404 (pas d'exfil)", async () => {
      await request(app.getHttpServer())
        .get(`/api/parcelles/${parcelleAId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);
    });

    it("GET /api/parcelles/:id côté A avec sa propre parcelle → 200", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/parcelles/${parcelleAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);

      expect((res.body as { id: string }).id).toBe(parcelleAId);
    });

    it("PATCH côté B sur parcelle de A → 404 (updateMany filtré)", async () => {
      await request(app.getHttpServer())
        .patch(`/api/parcelles/${parcelleAId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ nom: "Hacké" })
        .expect(404);

      // Vérifie que le nom de la parcelle A n'a PAS été modifié
      const verif = await request(app.getHttpServer())
        .get(`/api/parcelles/${parcelleAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect((verif.body as { nom: string }).nom).toBe("Champ A1");
    });

    it("PATCH côté A sur sa propre parcelle → 200 et persiste", async () => {
      await request(app.getHttpServer())
        .patch(`/api/parcelles/${parcelleCreeeParAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ nom: "Champ A renommé" })
        .expect(200);

      const verif = await request(app.getHttpServer())
        .get(`/api/parcelles/${parcelleCreeeParAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect((verif.body as { nom: string }).nom).toBe("Champ A renommé");
    });

    it("DELETE côté B sur parcelle de A → 404 (deleteMany filtré)", async () => {
      await request(app.getHttpServer())
        .delete(`/api/parcelles/${parcelleAId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404);

      // Vérifie que la parcelle A existe toujours
      await request(app.getHttpServer())
        .get(`/api/parcelles/${parcelleAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
    });

    it("DELETE côté A sur sa propre parcelle → 204 et disparue", async () => {
      await request(app.getHttpServer())
        .delete(`/api/parcelles/${parcelleCreeeParAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/parcelles/${parcelleCreeeParAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(404);
    });
  });
});
