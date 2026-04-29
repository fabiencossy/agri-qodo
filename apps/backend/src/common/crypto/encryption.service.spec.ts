import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { EncryptionService } from "./encryption.service";

function makeService(keyHex: string): EncryptionService {
  const config = { get: (k: string) => (k === "ODOO_CREDENTIALS_KEY" ? keyHex : undefined) };
  return new EncryptionService(config as unknown as ConfigService);
}

describe("EncryptionService", () => {
  const keyHex = randomBytes(32).toString("hex");

  it("round-trip plaintext utf8", () => {
    const svc = makeService(keyHex);
    const plain = "api_key_abcd1234_éùà_💩";
    const ct = svc.encrypt(plain);
    expect(ct).not.toContain(plain);
    expect(svc.decrypt(ct)).toBe(plain);
  });

  it("génère un ciphertext différent à chaque appel (IV aléatoire)", () => {
    const svc = makeService(keyHex);
    const plain = "secret";
    expect(svc.encrypt(plain)).not.toBe(svc.encrypt(plain));
  });

  it("rejette une clé absente", () => {
    expect(() => makeService("")).toThrow(/ODOO_CREDENTIALS_KEY/);
  });

  it("rejette une clé de mauvaise taille", () => {
    expect(() => makeService("00".repeat(16))).toThrow(/32 bytes/);
  });

  it("rejette un payload altéré (tag GCM)", () => {
    const svc = makeService(keyHex);
    const ct = svc.encrypt("hello");
    const buf = Buffer.from(ct, "base64url");
    const last = buf.length - 1;
    buf[last] = (buf[last] ?? 0) ^ 0x01;
    const tampered = buf.toString("base64url");
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it("rejette un payload trop court", () => {
    const svc = makeService(keyHex);
    expect(() => svc.decrypt("AAAA")).toThrow(/trop court/);
  });

  it("ne se déchiffre pas avec une autre clé", () => {
    const svc1 = makeService(keyHex);
    const svc2 = makeService(randomBytes(32).toString("hex"));
    const ct = svc1.encrypt("hello");
    expect(() => svc2.decrypt(ct)).toThrow();
  });
});
