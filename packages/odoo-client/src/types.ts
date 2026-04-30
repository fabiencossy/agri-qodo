/**
 * Types publics du client Odoo.
 */

export interface OdooConnectionConfig {
  /** URL de base Odoo, sans trailing slash. Ex: https://ferme-rolet.odoo.com */
  url: string;
  /** Nom de la base de données Odoo. */
  database: string;
  /** Login (email du compte de service). */
  username: string;
  /** API key (Odoo 14+). Préférée au password classique. */
  apiKey: string;
  /** Timeout de chaque requête en ms (défaut 30s). */
  timeoutMs?: number;
}

export interface OdooVersion {
  /** Ex "19.0+e" (Enterprise) ou "20.0" (Community/Online). */
  serverVersion: string;
  /** [major, minor, patch, releaseLevel, serial, suffix]. */
  serverVersionInfo: [number, number, number, string, number, string];
  /** "production" / "staging". */
  serverSerie: string;
  /** "1" si le serveur est en mode debug. */
  protocolVersion: number;
}

export interface AuthenticatedSession {
  uid: number;
  version: OdooVersion;
  /** Major version (19, 20, …) — utile pour les adapters. */
  majorVersion: number;
}

export type OdooDomain = unknown[]; // ex: [["name", "ilike", "Foo"], ["active", "=", true]]

export interface SearchReadOptions {
  fields?: string[];
  offset?: number;
  limit?: number;
  order?: string;
}

/** Erreur structurée renvoyée par Odoo (data.message + debug). */
export class OdooError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(message);
    this.name = "OdooError";
  }
}

/** Erreur d'authentification (login/api_key invalide, db inconnue, etc.). */
export class OdooAuthError extends OdooError {
  constructor(message: string, data: unknown) {
    super(message, 401, data);
    this.name = "OdooAuthError";
  }
}
