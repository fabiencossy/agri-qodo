import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard
const KEY_LEN = 32; // AES-256
const TAG_LEN = 16;

/**
 * Chiffre/déchiffre des secrets applicatifs (API keys Odoo, etc.) via
 * AES-256-GCM avec une clé maître unique stockée hors DB.
 *
 * Format de sortie : `base64url(iv || tag || ciphertext)`. L'IV est
 * généré aléatoirement à chaque chiffrement (jamais réutilisé). Le tag
 * GCM authentifie l'intégrité (déchiffrement échoue si la donnée a été
 * altérée — fail loud, pas de fallback silencieux).
 *
 * Clé maître : `ODOO_CREDENTIALS_KEY` dans l'env, attendue en hex
 * 64 caractères (= 32 bytes). Générer une nouvelle clé en prod :
 *   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>("ODOO_CREDENTIALS_KEY");
    if (!raw) {
      throw new Error(
        "ODOO_CREDENTIALS_KEY manquante — générer une clé via " +
          "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
          "et l'ajouter à .env",
      );
    }
    const buf = Buffer.from(raw, "hex");
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `ODOO_CREDENTIALS_KEY doit être 32 bytes hex (64 caractères), reçu ${buf.length} bytes`,
      );
    }
    this.key = buf;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString("base64url");
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < IV_LEN + TAG_LEN + 1) {
      throw new Error("payload chiffré trop court");
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  }
}
