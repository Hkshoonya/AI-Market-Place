import { readdir } from "fs/promises";
import { join } from "path";

export interface RevenueReportSummary {
  slug: string;
  title: string;
  filename: string;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export async function listPublishedRevenueReports(
  baseDir = join(process.cwd(), "reports", "revenue")
) {
  const entries = await readdir(baseDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /^\d{4}-\d{2}\.md$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
    .map<RevenueReportSummary>((filename) => {
      const slug = filename.replace(/\.md$/, "");
      const [year, month] = slug.split("-").map(Number);

      return {
        slug,
        title: MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1))),
        filename,
      };
    });
}
