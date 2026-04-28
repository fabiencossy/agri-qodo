import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Canton } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "@/app.module";
import { PrismaService } from "@/common/prisma/prisma.service";
import { configureApp } from "@/configure-app";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const credentials = {
    email: "test-auth@agri-qodo.test",
    password: "TestPassword123!",
  };

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
      data: {
        code: "AQ-VD-TEST-AUTH",
        nom: "Ferme test auth",
        canton: Canton.VD,
      },
    });
    await prisma.user.create({
      data: {
        email: credentials.email,
        passwordHash: await bcrypt.hash(credentials.password, 10),
        prenom: "Test",
        nom: "Auth",
        tenantId: tenant.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.truncateAll();
    await app.close();
  });

  it("POST /api/auth/login renvoie un couple de tokens", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send(credentials)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
  });

  it("POST /api/auth/login refuse un mauvais mot de passe", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "WrongPassword123" })
      .expect(401);
  });

  it("POST /api/auth/refresh fait tourner les tokens", async () => {
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send(credentials)
      .expect(200);

    const { refreshToken } = loginRes.body as { refreshToken: string };

    const refreshRes = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(refreshToken);

    // L'ancien refresh token est révoqué
    await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken }).expect(401);
  });
});
