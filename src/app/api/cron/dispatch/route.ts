import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import cronJobs from "../../../../../config/cron-jobs.json";
import { systemLog } from "@/lib/logging";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const DispatchRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  path: z.string().trim().min(1).max(500),
  scheduledTime: z.string().datetime({ offset: true }).optional(),
});

function resolveInternalBaseUrl() {
  const configuredPort = Number.parseInt(process.env.PORT ?? "3000", 10);
  const port =
    Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65_535
      ? configuredPort
      : 3000;
  return `http://127.0.0.1:${port}`;
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = DispatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid dispatch request" },
      { status: 400 }
    );
  }

  const job = cronJobs.find(
    (candidate) =>
      candidate.path === parsed.data.path &&
      (!parsed.data.name || candidate.name === parsed.data.name)
  );
  if (!job) {
    return NextResponse.json({ error: "Unknown cron job" }, { status: 404 });
  }

  const targetUrl = new URL(job.path, resolveInternalBaseUrl()).toString();
  const scheduledTime = parsed.data.scheduledTime ?? new Date().toISOString();

  after(async () => {
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "User-Agent": "aimarketcap-background-cron/1.0",
          "X-AIMC-Cron-Job": job.name,
          "X-AIMC-Scheduled-Time": scheduledTime,
        },
        signal: AbortSignal.timeout(600_000),
      });
      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(
          `${job.name} returned HTTP ${response.status}: ${responseBody.slice(0, 300)}`
        );
      }
    } catch (error) {
      await systemLog.error("cron-dispatch", "Background cron job failed", {
        job: job.name,
        path: job.path,
        scheduledTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return NextResponse.json(
    {
      accepted: true,
      job: job.name,
      path: job.path,
      scheduledTime,
    },
    { status: 202 }
  );
}
