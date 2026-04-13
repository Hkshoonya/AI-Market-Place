import { NextResponse } from "next/server";
import { getIndexNowKey } from "@/lib/seo/indexnow";

export function GET() {
  const key = getIndexNowKey();

  if (!key) {
    return new NextResponse("IndexNow is not configured.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new NextResponse(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
