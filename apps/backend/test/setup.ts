/**
 * Setup global Jest e2e.
 * Bascule sur DATABASE_URL_TEST si défini (pour ne pas wiper la dev DB).
 */
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
