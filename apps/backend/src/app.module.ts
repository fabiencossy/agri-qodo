import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { CryptoModule } from "./common/crypto/crypto.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RuleEngineModule } from "./common/rule-engine/rule-engine.module";
import { TenantModule } from "./common/tenant/tenant.module";
import { validateEnv } from "./config/env.schema";
import { AnimauxModule } from "./modules/animaux/animaux.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { InterventionsModule } from "./modules/interventions/interventions.module";
import { MailerModule } from "./modules/mailer/mailer.module";
import { MaterielsModule } from "./modules/materiels/materiels.module";
import { OdooModule } from "./modules/odoo/odoo.module";
import { OdooConfigModule } from "./modules/odoo-config/odoo-config.module";
import { ParcellesModule } from "./modules/parcelles/parcelles.module";
import { PartnerLinksModule } from "./modules/partner-links/partner-links.module";
import { PerModule } from "./modules/per/per.module";
import { PlanFumureModule } from "./modules/plan-fumure/plan-fumure.module";
import { PresencesModule } from "./modules/presences/presences.module";
import { ProduitsModule } from "./modules/produits/produits.module";
import { ProjetsModule } from "./modules/projets/projets.module";
import { SrpaModule } from "./modules/srpa/srpa.module";
import { SuisseBilanzModule } from "./modules/suisse-bilanz/suisse-bilanz.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { TravauxModule } from "./modules/travaux/travaux.module";
import { VeilleModule } from "./modules/veille/veille.module";

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
    CryptoModule,
    MailerModule,
    RuleEngineModule,
    AuditModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ParcellesModule,
    InterventionsModule,
    SrpaModule,
    AnimauxModule,
    ProduitsModule,
    ProjetsModule,
    MaterielsModule,
    SuisseBilanzModule,
    PlanFumureModule,
    PerModule,
    PartnerLinksModule,
    OdooModule,
    OdooConfigModule,
    TravauxModule,
    PresencesModule,
    VeilleModule,
  ],
})
export class AppModule {}
