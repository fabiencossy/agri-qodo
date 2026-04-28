import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RuleEngineModule } from "./common/rule-engine/rule-engine.module";
import { TenantModule } from "./common/tenant/tenant.module";
import { validateEnv } from "./config/env.schema";
import { AnimauxModule } from "./modules/animaux/animaux.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { InterventionsModule } from "./modules/interventions/interventions.module";
import { ParcellesModule } from "./modules/parcelles/parcelles.module";
import { PartnerLinksModule } from "./modules/partner-links/partner-links.module";
import { SrpaModule } from "./modules/srpa/srpa.module";
import { SuisseBilanzModule } from "./modules/suisse-bilanz/suisse-bilanz.module";
import { TenantsModule } from "./modules/tenants/tenants.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        ...(process.env.NODE_ENV === "production"
          ? {}
          : {
              transport: {
                target: "pino-pretty",
                options: { singleLine: true, colorize: true },
              },
            }),
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.refreshToken",
          ],
          remove: true,
        },
      },
    }),
    PrismaModule,
    TenantModule,
    RuleEngineModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    ParcellesModule,
    InterventionsModule,
    SrpaModule,
    AnimauxModule,
    SuisseBilanzModule,
    PartnerLinksModule,
  ],
})
export class AppModule {}
