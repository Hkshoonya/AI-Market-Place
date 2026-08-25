import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptProviderSecret,
  encryptProviderSecret,
  getProviderSecretHint,
} from "./crypto";

const originalKey = process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY;

describe("provider credential encryption", () => {
  beforeEach(() => {
    process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY = originalKey;
    }
  });

  it("round-trips a credential without storing plaintext", () => {
    const encrypted = encryptProviderSecret("  sk-provider-secret-1234  ");

    expect(encrypted).not.toContain("sk-provider-secret-1234");
    expect(decryptProviderSecret(encrypted)).toBe("sk-provider-secret-1234");
    expect(getProviderSecretHint("sk-provider-secret-1234")).toBe("...1234");
  });

  it("rejects a tampered authenticated-encryption envelope", () => {
    const encrypted = encryptProviderSecret("sk-provider-secret-1234");
    const parts = encrypted.split(".");
    const authenticationTag = parts[3] ?? "";
    const tamperIndex = Math.floor(authenticationTag.length / 2);
    parts[3] = `${authenticationTag.slice(0, tamperIndex)}${
      authenticationTag[tamperIndex] === "A" ? "B" : "A"
    }${authenticationTag.slice(tamperIndex + 1)}`;

    expect(() => decryptProviderSecret(parts.join("."))).toThrow(
      /could not be decrypted/i
    );
  });

  it("fails closed when the configured key is not 256 bits", () => {
    process.env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");

    expect(() => encryptProviderSecret("sk-provider-secret-1234")).toThrow(
      /32 bytes/i
    );
  });
});
