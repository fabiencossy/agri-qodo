/**
 * Seed minimal pour le développement local.
 * Crée une exploitation de démo + un user owner.
 *
 * Lancer avec : `pnpm --filter backend exec ts-node prisma/seed.ts`
 * (ou via `prisma db seed` après config).
 */
import { Canton, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const code = `AQ-VD-1247-${randomBytes(2).toString("hex").toUpperCase()}`;

  const tenant = await prisma.exploitation.upsert({
    where: { code: "AQ-VD-1247-DEMO" },
    update: {},
    create: {
      code: "AQ-VD-1247-DEMO",
      nom: "Ferme de démo (Rolet)",
      canton: Canton.VD,
      numeroUfam: "1247",
      adresse: "Route du Champ-du-Loup 12",
      npa: "1141",
      localite: "Sévery",
      emailContact: "marie@ferme-rolet.test",
    },
  });

  const passwordHash = await bcrypt.hash("DemoPassword123!", 10);

  await prisma.user.upsert({
    where: { email: "marie@ferme-rolet.test" },
    update: {},
    create: {
      email: "marie@ferme-rolet.test",
      passwordHash,
      prenom: "Marie",
      nom: "Rolet",
      role: "OWNER",
      tenantId: tenant.id,
    },
  });

  console.log(
    `Seed OK : tenant ${tenant.code} + user marie@ferme-rolet.test (mdp DemoPassword123!)`,
  );

  console.log(`Code généré pour info : ${code}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
