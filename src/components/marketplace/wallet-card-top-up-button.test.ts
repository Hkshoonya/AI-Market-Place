import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isStripeCheckoutUrl,
  requestWalletCardCheckout,
} from "./wallet-card-top-up-button";

describe("wallet card checkout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts only the Stripe Checkout origin", () => {
    expect(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_live_123")).toBe(true);
    expect(isStripeCheckoutUrl("https://checkout.stripe.com.evil.example/session")).toBe(false);
    expect(isStripeCheckoutUrl("javascript:alert(1)")).toBe(false);
  });

  it("requests a server-approved pack and local return path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_live_123" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestWalletCardCheckout({ pack: "builder", returnPath: "/workspace" })
    ).resolves.toBe("https://checkout.stripe.com/c/pay/cs_live_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/marketplace/wallet/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pack: "builder", return_path: "/workspace" }),
      })
    );
  });

  it("rejects a non-Stripe redirect returned by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: "https://evil.example/checkout" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(
      requestWalletCardCheckout({ pack: "starter", returnPath: "/workspace" })
    ).rejects.toThrow("invalid payment URL");
  });
});
