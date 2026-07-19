import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENVELOPE_VERSION = "v1";

function getEncryptionKey() {
  const configured = process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error("Provider credential encryption is not configured");
  }

  let key: Buffer;
  try {
    key = Buffer.from(configured, "base64");
  } catch {
    throw new Error("Provider credential encryption key is invalid");
  }

  if (key.length !== 32) {
    throw new Error("Provider credential encryption key must decode to 32 bytes");
  }

  return key;
}

export function encryptProviderSecret(secret: string) {
  const normalized = secret.trim();
  if (!normalized) throw new Error("Provider credential is empty");

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptProviderSecret(envelope: string) {
  const [version, ivValue, tagValue, ciphertextValue, extra] = envelope.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error("Provider credential envelope is invalid");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Provider credential could not be decrypted");
  }
}

export function getProviderSecretHint(secret: string) {
  const normalized = secret.trim();
  const visible = normalized.slice(-4);
  return visible ? `...${visible}` : "hidden";
}
