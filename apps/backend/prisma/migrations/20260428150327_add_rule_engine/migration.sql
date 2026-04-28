-- CreateEnum
CREATE TYPE "RuleSetScope" AS ENUM ('GLOBAL', 'CANTON', 'TENANT');

-- CreateTable
CREATE TABLE "rule_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "RuleSetScope" NOT NULL,
    "tenant_id" TEXT,
    "canton" "Canton",
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "rule_set_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rule_sets_name_key" ON "rule_sets"("name");

-- CreateIndex
CREATE INDEX "rule_sets_scope_idx" ON "rule_sets"("scope");

-- CreateIndex
CREATE INDEX "rule_sets_tenant_id_idx" ON "rule_sets"("tenant_id");

-- CreateIndex
CREATE INDEX "rules_key_idx" ON "rules"("key");

-- CreateIndex
CREATE UNIQUE INDEX "rules_rule_set_id_key_key" ON "rules"("rule_set_id", "key");

-- AddForeignKey
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "exploitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
