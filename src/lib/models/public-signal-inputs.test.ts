import { describe, expect, it } from "vitest";

import {
  hasPublicSignalInputs,
  stripPublicSignalInputs,
} from "./public-signal-inputs";

describe("public signal inputs", () => {
  it("detects positive HF signal fields", () => {
    expect(
      hasPublicSignalInputs({
        slug: "community-model",
        hf_downloads: 100,
      })
    ).toBe(true);
  });

  it("ignores null and zero signal fields", () => {
    expect(
      hasPublicSignalInputs({
        slug: "community-model",
        hf_downloads: 0,
        hf_likes: null,
        hf_trending_score: 0,
      })
    ).toBe(false);
  });

  it("strips public signal fields", () => {
    expect(
      stripPublicSignalInputs({
        slug: "community-model",
        hf_downloads: 100,
        hf_likes: 25,
        hf_trending_score: 4,
      })
    ).toMatchObject({
      slug: "community-model",
      hf_downloads: null,
      hf_likes: null,
      hf_trending_score: null,
    });
  });
});
