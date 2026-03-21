import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";

import { listPublishedRevenueReports } from "./reporting";

const tempDirs: string[] = [];

describe("listPublishedRevenueReports", () => {
  afterEach(() => {
    tempDirs.length = 0;
  });

  it("returns published monthly reports in reverse chronological order", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "aimc-revenue-"));
    tempDirs.push(baseDir);
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "2026-02.md"), "# February");
    writeFileSync(join(baseDir, "2026-03.md"), "# March");
    writeFileSync(join(baseDir, "README.md"), "# ignore");

    const reports = await listPublishedRevenueReports(baseDir);

    expect(reports).toEqual([
      {
        slug: "2026-03",
        title: "March 2026",
        filename: "2026-03.md",
      },
      {
        slug: "2026-02",
        title: "February 2026",
        filename: "2026-02.md",
      },
    ]);
  });

  it("ignores templates and returns an empty list when no reports are published", async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "aimc-revenue-empty-"));
    tempDirs.push(baseDir);
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(join(baseDir, "_template.md"), "# template");
    writeFileSync(join(baseDir, "README.md"), "# readme");

    await expect(listPublishedRevenueReports(baseDir)).resolves.toEqual([]);
  });
});
