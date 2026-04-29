-- Email partagé entre tenants : un même email (comptable, conseiller, …)
-- peut avoir un compte sur plusieurs exploitations. L'unicité passe sur
-- la paire (email, tenant_id).

DROP INDEX IF EXISTS "users_email_key";

CREATE UNIQUE INDEX "users_email_tenant_id_key" ON "users"("email", "tenant_id");

CREATE INDEX "users_email_idx" ON "users"("email");
