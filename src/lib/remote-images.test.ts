import { describe, expect, it } from "vitest";
import { getRemoteImagePatterns } from "./remote-images";

describe("remote image allowlist", () => {
  it("allows only the configured project's storage and the existing avatar service", () => {
    expect(getRemoteImagePatterns("https://my-project.supabase.co")).toEqual([
      { protocol: "https", hostname: "api.dicebear.com", port: "", pathname: "/**" },
      { protocol: "https", hostname: "my-project.supabase.co", port: "", pathname: "/storage/v1/**" },
    ]);
  });

  it.each([undefined, "invalid", "http://localhost:54321", "https://user:pass@project.supabase.co", "https://project.supabase.co:8443"])(
    "does not broaden the allowlist for invalid configuration: %s", (url) => {
      expect(getRemoteImagePatterns(url)).toHaveLength(1);
    }
  );
});
