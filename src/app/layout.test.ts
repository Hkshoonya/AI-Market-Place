import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants/site";
import { buildRootMetadata, buildSiteVerificationMetadata } from "@/lib/seo/root-metadata";

describe("root layout metadata", () => {
  afterEach(() => {
    delete process.env.GOOGLE_SITE_VERIFICATION;
    delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
    delete process.env.BING_SITE_VERIFICATION;
    delete process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
    vi.unstubAllEnvs();
  });

  it("omits verification metadata when no tokens are configured", () => {
    expect(buildSiteVerificationMetadata()).toBeUndefined();
  });

  it("builds Google and Bing verification metadata from environment variables", () => {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "google-token");
    vi.stubEnv("BING_SITE_VERIFICATION", "bing-token");

    expect(buildSiteVerificationMetadata()).toEqual({
      google: "google-token",
      other: {
        "msvalidate.01": "bing-token",
      },
    });
  });

  it("adds sitewide social images and metadata defaults", () => {
    const metadata = buildRootMetadata();

    expect(metadata.description).toBe(SITE_DESCRIPTION);
    expect(metadata.openGraph).toMatchObject({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [
        expect.objectContaining({
          url: "/opengraph-image",
          alt: SITE_NAME,
        }),
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/twitter-image"],
    });
  });
});
