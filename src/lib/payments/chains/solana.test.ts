import { afterEach, describe, expect, it } from "vitest";
import { isSolanaConfigured, isSolanaEnabled } from "./solana";

const ORIGINAL_ENABLE_SOLANA_CHAIN = process.env.ENABLE_SOLANA_CHAIN;
const ORIGINAL_SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

describe("solana chain availability", () => {
  afterEach(() => {
    if (ORIGINAL_ENABLE_SOLANA_CHAIN === undefined) {
      delete process.env.ENABLE_SOLANA_CHAIN;
    } else {
      process.env.ENABLE_SOLANA_CHAIN = ORIGINAL_ENABLE_SOLANA_CHAIN;
    }

    if (ORIGINAL_SOLANA_RPC_URL === undefined) {
      delete process.env.SOLANA_RPC_URL;
    } else {
      process.env.SOLANA_RPC_URL = ORIGINAL_SOLANA_RPC_URL;
    }
  });

  it("defaults Solana off when the launch flag is unset", () => {
    delete process.env.ENABLE_SOLANA_CHAIN;
    process.env.SOLANA_RPC_URL = "https://rpc.example.test";

    expect(isSolanaEnabled()).toBe(false);
    expect(isSolanaConfigured()).toBe(false);
  });

  it("treats Solana as configured only when both the flag and RPC URL are present", () => {
    process.env.ENABLE_SOLANA_CHAIN = "true";
    process.env.SOLANA_RPC_URL = "https://rpc.example.test";

    expect(isSolanaEnabled()).toBe(true);
    expect(isSolanaConfigured()).toBe(true);
  });
});
