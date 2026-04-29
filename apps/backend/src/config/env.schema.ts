import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  DATABASE_URL_TEST: z.string().optional(),
  // Redis pas encore utilisé en MVP (pas de cache de sessions distribué).
  // Optional pour ne pas bloquer le démarrage en prod sans Redis.
  REDIS_URL: z.string().startsWith("redis://").optional(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET doit faire au moins 32 caractères"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CH_LOGIN_ISSUER: z.string().optional(),
  CH_LOGIN_CLIENT_ID: z.string().optional(),
  CH_LOGIN_CLIENT_SECRET: z.string().optional(),

  // Clé maître pour chiffrer les API keys Odoo des tenants (AES-256-GCM).
  // 32 bytes hex (64 caractères). Génération :
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Doit rester stable une fois en prod (sinon les API keys deviennent illisibles).
  ODOO_CREDENTIALS_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ODOO_CREDENTIALS_KEY doit être 64 caractères hex (32 bytes)"),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default("agri-qodo-backend"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides :\n${issues}`);
  }
  return parsed.data;
}
