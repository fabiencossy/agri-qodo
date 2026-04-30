/**
 * @agri-qodo/odoo-client — client Odoo Enterprise pour Agri Qodo.
 *
 * Une connexion par tenant (cf §M6 spec). Multi-version v19+ via
 * `version-adapter.ts`. JSON-RPC 2.0 sur `/jsonrpc`, pas de dépendance
 * externe.
 */

export const PACKAGE_NAME = "@agri-qodo/odoo-client" as const;

export { createOdooClient, type OdooClient } from "./client";
export { pickAdapter, type VersionAdapter } from "./version-adapter";
export {
  type AuthenticatedSession,
  OdooAuthError,
  type OdooConnectionConfig,
  type OdooDomain,
  OdooError,
  type OdooVersion,
  type SearchReadOptions,
} from "./types";
