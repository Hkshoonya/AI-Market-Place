import { NextRequest, NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
import { trackCronRun } from "@/lib/cron-tracker";
import { isIndexNowConfigured, normalizeIndexNowUrls, submitIndexNowUrls } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type IndexNowRequestBody = {
  urls?: string[];
};

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

async function getRequestedUrls(request: NextRequest) {
  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as IndexNowRequestBody | null;
    if (Array.isArray(body?.urls) && body.urls.length > 0) {
      return {
        scope: "selected" as const,
        urls: normalizeIndexNowUrls(body.urls),
      };
    }
  }

  return {
    scope: "sitemap" as const,
    urls: (await sitemap()).map((route) => route.url),
  };
}

async function handleIndexNow(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isIndexNowConfigured()) {
    return NextResponse.json(
      { error: "IndexNow is not configured" },
      { status: 503 }
    );
  }

  const tracker = await trackCronRun("seo-indexnow");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const { scope, urls } = await getRequestedUrls(request);
    const result = await submitIndexNowUrls(urls);

    return tracker.complete({
      scope,
      submittedUrlCount: result.submittedUrlCount,
      batchCount: result.batchCount,
      host: result.host,
      keyLocation: result.keyLocation,
      endpoint: result.endpoint,
    });
  } catch (error) {
    return tracker.fail(error);
  }
}

export async function GET(request: NextRequest) {
  return handleIndexNow(request);
}

export async function POST(request: NextRequest) {
  return handleIndexNow(request);
}
