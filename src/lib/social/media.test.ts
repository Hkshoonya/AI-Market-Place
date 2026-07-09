import { describe, expect, it } from "vitest";

import {
  SocialImageAttachmentListSchema,
  isSafeSocialImageUrl,
  normalizeSocialImageAttachments,
} from "./media";

describe("social image URL safety", () => {
  it.each([
    "http://images.example.com/file.png",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg></svg>",
    "https://localhost/image.png",
    "https://127.0.0.1/image.png",
    "https://10.0.0.1/image.png",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/image.png",
    "https://user:password@images.example.com/file.png",
  ])("rejects unsafe image URL %s", (url) => {
    expect(isSafeSocialImageUrl(url)).toBe(false);
    expect(SocialImageAttachmentListSchema.safeParse([{ url }]).success).toBe(false);
  });

  it("accepts public HTTPS image URLs", () => {
    expect(isSafeSocialImageUrl("https://images.example.com/file.png?width=1200")).toBe(true);
  });

  it("deduplicates valid attachments and filters unsafe legacy input", () => {
    expect(
      normalizeSocialImageAttachments([
        { url: "https://images.example.com/file.png", alt_text: " First " },
        { url: "https://images.example.com/file.png", alt_text: "Updated" },
        { url: "https://127.0.0.1/private.png" },
      ])
    ).toEqual([
      { url: "https://images.example.com/file.png", alt_text: "Updated" },
    ]);
  });

  it("limits posts to four image attachments", () => {
    const images = Array.from({ length: 5 }, (_, index) => ({
      url: `https://images.example.com/${index}.png`,
    }));

    expect(SocialImageAttachmentListSchema.safeParse(images).success).toBe(false);
  });
});
