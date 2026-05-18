import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("returns a plain text public site guide for AI crawlers and assistants", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");

    const body = await response.text();
    expect(body).toContain(`# ${SITE_NAME}`);
    expect(body).toContain(`${SITE_URL}/models`);
    expect(body).toContain(`${SITE_URL}/leaderboards`);
    expect(body).toContain(`${SITE_URL}/sitemap.xml`);
    expect(body).toContain("not intended as discovery surfaces");
  });
});
