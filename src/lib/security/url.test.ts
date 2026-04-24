import { describe, expect, it } from "vitest";
import {
  getSafeExternalHref,
  isSafeExternalUrl,
  normalizeOptionalHttpUrl,
  nullableHttpUrlSchema,
} from "./url";

describe("url security helpers", () => {
  it("accepts http and https URLs only", () => {
    expect(isSafeExternalUrl("https://example.com/docs")).toBe(true);
    expect(isSafeExternalUrl("http://example.com/docs")).toBe(true);
    expect(isSafeExternalUrl("ftp://example.com/file")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,hi")).toBe(false);
  });

  it("returns null for unsafe rendered hrefs", () => {
    expect(getSafeExternalHref("https://example.com/demo")).toBe(
      "https://example.com/demo"
    );
    expect(getSafeExternalHref("javascript:alert(1)")).toBeNull();
  });

  it("normalizes optional URL values and rejects unsafe schemes", () => {
    expect(
      normalizeOptionalHttpUrl(" https://example.com/docs ", "demo_url")
    ).toBe("https://example.com/docs");
    expect(normalizeOptionalHttpUrl("", "demo_url")).toBeNull();
    expect(() =>
      normalizeOptionalHttpUrl("javascript:alert(1)", "demo_url")
    ).toThrow(/http or https/i);
  });

  it("provides a zod schema for nullable public URLs", () => {
    const schema = nullableHttpUrlSchema("documentation_url");

    expect(
      schema.safeParse("https://example.com/docs").success
    ).toBe(true);
    expect(schema.safeParse("").success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});
