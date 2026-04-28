import { ValidationPipe, type INestApplication } from "@nestjs/common";
import helmet from "helmet";
import { tenantContextMiddleware } from "./common/tenant/tenant-context.middleware";
import { TenantContextService } from "./common/tenant/tenant-context.service";

/**
 * Applique la config commune à une instance Nest (production + tests).
 * Le middleware tenant est posé EN PREMIER — c'est critique pour
 * l'isolation multi-tenant.
 */
export function configureApp(app: INestApplication): void {
  app.use(tenantContextMiddleware(app.get(TenantContextService)));
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix("api", { exclude: ["health"] });
}
