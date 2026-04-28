/**
 * Initialisation RxDB pour le mode offline web.
 *
 * Étape 3 = healthcheck minimal : ouvre la DB, écrit/lit une entrée
 * dans une collection `_health` pour valider que l'IndexedDB est accessible.
 *
 * Étapes 5-6 ajouteront les collections métier (parcelles, interventions,
 * cultures) avec sync vers le backend.
 */
import { type RxDatabase, addRxPlugin, createRxDatabase } from "rxdb/plugins/core";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

let dbPromise: Promise<RxDatabase> | null = null;

const HEALTH_SCHEMA = {
  version: 0,
  primaryKey: "id",
  type: "object" as const,
  properties: {
    id: { type: "string" as const, maxLength: 64 },
    writtenAt: { type: "string" as const, maxLength: 32 },
  },
  required: ["id", "writtenAt"],
};

export async function getRxDb(): Promise<RxDatabase> {
  if (typeof window === "undefined") {
    throw new Error("RxDB ne peut tourner que côté navigateur");
  }
  if (dbPromise) return dbPromise;

  if (process.env.NODE_ENV !== "production") {
    addRxPlugin(RxDBDevModePlugin);
  }

  dbPromise = createRxDatabase({
    name: "agri_qodo",
    storage: getRxStorageDexie(),
    multiInstance: true,
    eventReduce: true,
    ignoreDuplicate: true,
  }).then(async (db) => {
    await db.addCollections({
      _health: { schema: HEALTH_SCHEMA },
    });
    return db;
  });

  return dbPromise;
}

/**
 * Healthcheck simple : insert + read sur la collection `_health`.
 * Renvoie true si l'IndexedDB répond correctement.
 */
export async function rxdbHealthcheck(): Promise<boolean> {
  const db = await getRxDb();
  const entry = {
    id: `health-${Date.now()}`,
    writtenAt: new Date().toISOString(),
  };
  await db.collections._health?.insert(entry);
  const read = await db.collections._health?.findOne(entry.id).exec();
  return read?.id === entry.id;
}
