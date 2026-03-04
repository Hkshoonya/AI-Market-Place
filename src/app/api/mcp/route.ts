import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { handleMcpRequest } from "@/lib/mcp/server";
import { extractApiKey, validateApiKey } from "@/lib/agents/auth";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import type { JsonRpcRequest } from "@/lib/mcp/types";
import { JSON_RPC_ERRORS } from "@/lib/mcp/types";

export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // Rate limit MCP requests
  const ip = getClientIp(request);
  const rl = rateLimit(`mcp:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Rate limit exceeded" },
      },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = createServiceClient();

  // Authenticate via API key (optional for read-only, required for write operations)
  let keyRecord: Record<string, unknown> | undefined;
  const apiKey = extractApiKey(request);

  if (apiKey) {
    const auth = await validateApiKey(supabase, apiKey);
    if (auth.valid && auth.keyRecord) {
      keyRecord = auth.keyRecord;
    } else {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: JSON_RPC_ERRORS.INTERNAL_ERROR, message: auth.error ?? "Invalid API key" },
        },
        { status: 401 }
      );
    }
  }

  // Parse JSON-RPC request
  let body: JsonRpcRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: JSON_RPC_ERRORS.PARSE_ERROR, message: "Invalid JSON" },
      },
      { status: 400 }
    );
  }

  // Validate JSON-RPC structure
  if (body.jsonrpc !== "2.0" || !body.method || body.id === undefined) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body?.id ?? null,
        error: { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: "Invalid JSON-RPC 2.0 request" },
      },
      { status: 400 }
    );
  }

  // Handle the request
  const response = await handleMcpRequest(supabase, body, keyRecord);

  return NextResponse.json(response);
}
