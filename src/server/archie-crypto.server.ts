import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function deriveEncryptionKey() {
  const secret = process.env.ARCHIE_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("ARCHIE_ENCRYPTION_KEY must be configured with at least 32 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptProviderKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptProviderKey(encrypted: string) {
  const packed = Buffer.from(encrypted, "base64");
  if (packed.length < 29) throw new Error("Encrypted AI provider key is invalid");
  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
}

export function maskProviderKey(value: string) {
  return value.length <= 3 ? "•".repeat(value.length) : `••••••••${value.slice(-3)}`;
}
