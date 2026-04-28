// Init telemetry AVANT toute autre import (instrumentation)
import { setupTelemetry } from "./telemetry/tracing";
const otelSdk = setupTelemetry();

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { Env } from "./config/env.schema";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Env, true>);
  const isDev = config.get("NODE_ENV", { infer: true }) === "development";

  app.use(helmet());
  app.enableCors({
    origin: isDev ? true : false, // à durcir en prod via une whitelist
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix("api", { exclude: ["health"] });

  if (isDev) {
    const docConfig = new DocumentBuilder()
      .setTitle("Agri Qodo — API")
      .setDescription("ERP métier de l'exploitation agricole suisse (offline-first, multi-tenant).")
      .setVersion("0.0.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`🌱 Agri Qodo backend prêt sur http://localhost:${port}`);
  if (isDev) {
    console.log(`📖 Swagger UI : http://localhost:${port}/api/docs`);
  }
}

void bootstrap();

// Shutdown propre OTel sur SIGTERM
process.on("SIGTERM", () => {
  void otelSdk?.shutdown();
});
