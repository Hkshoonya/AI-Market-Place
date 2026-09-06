import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listProviderConnections,
  getProviderConnectionSecret,
} from "@/lib/provider-connections/server";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { RUNPOD_MODELS } from "@/lib/runpod/catalog";
import { getRunpodGpus, RunpodError } from "@/lib/runpod/client";
import {
  publicPod,
  quoteRunpodPod,
  launchRunpodPod,
  operateRunpodPod,
  revealRunpodApiKey,
  runpodLaunchEnabled,
} from "@/lib/runpod/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers });

async function requireUser() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return { error: json({ error: "Unauthorized" }, 401) };
  const { data: profile, error: profileError } = await createAdminClient()
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .single();
  if (profileError || !profile || profile.is_banned)
    return { error: json({ error: "Account unavailable" }, 403) };
  return { user };
}

function failure(error: unknown) {
  if (error instanceof RunpodError)
    return json({ error: error.message }, error.status);
  // Do not log SDK errors, upstream bodies or credential envelopes.
  return json(
    {
      error:
        "Pod operation could not be confirmed. Refresh status and check the Runpod console before retrying.",
    },
    502,
  );
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const limit = await rateLimit(`runpod-read:${auth.user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!limit.success)
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { ...headers, ...rateLimitHeaders(limit) } },
      );
    const connectionId = new URL(request.url).searchParams.get("connectionId");
    const connections = (await listProviderConnections(auth.user.id)).filter(
      (connection) =>
        connection.provider === "runpod" && connection.status === "active",
    );
    let gpus = null;
    if (connectionId) {
      if (
        !z.string().uuid().safeParse(connectionId).success ||
        !connections.some((connection) => connection.id === connectionId)
      ) {
        return json({ error: "Connection not found" }, 404);
      }
      const { secret } = await getProviderConnectionSecret({
        userId: auth.user.id,
        connectionId,
        expectedProvider: "runpod",
      });
      gpus = await getRunpodGpus(secret);
    }
    const admin = createAdminClient();
    // Recent terminated history must never push an older billable Pod off screen.
    const [active, history] = await Promise.all([
      admin
        .from("runpod_pods")
        .select("*")
        .eq("user_id", auth.user.id)
        .not("status", "in", "(quoted,terminated,failed)")
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("runpod_pods")
        .select("*")
        .eq("user_id", auth.user.id)
        .in("status", ["terminated", "failed"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (active.error) throw active.error;
    if (history.error) throw history.error;
    return json({
      pods: [...(active.data ?? []), ...(history.data ?? [])].map(publicPod),
      connections,
      models: RUNPOD_MODELS,
      gpus,
      launchEnabled: runpodLaunchEnabled(),
    });
  } catch (error) {
    return failure(error);
  }
}

const Id = z.string().uuid();
export const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("quote"),
      connectionId: Id,
      modelKey: z.string().min(1).max(100),
      gpuTypeId: z.string().min(1).max(150),
      volumeGb: z.union([z.literal(30), z.literal(50), z.literal(100)]),
    })
    .strict(),
  z
    .object({
      action: z.literal("launch"),
      id: Id,
      acceptProviderCharges: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal("refresh"), id: Id }).strict(),
  z
    .object({
      action: z.literal("stop"),
      id: Id,
      acceptStorageCharges: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("resume"),
      id: Id,
      acceptProviderCharges: z.literal(true),
      maxGpuPricePerHour: z.number().finite().positive().max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("terminate"),
      id: Id,
      confirmation: z.literal("DELETE POD AND DATA"),
    })
    .strict(),
  z.object({ action: z.literal("reveal_key"), id: Id }).strict(),
]);

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const text = await request.text();
    if (text.length > 4096) return json({ error: "Request too large" }, 413);
    const parsed = ActionSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return json(
        {
          error: "Invalid Pod request or missing charge/data-loss confirmation",
        },
        400,
      );
    const input = parsed.data;
    // Quoting or launch abuse must not consume the emergency stop allowance.
    const limit = await rateLimit(`runpod-${input.action}:${auth.user.id}`, {
      limit: 12,
      windowMs: 60_000,
    });
    if (!limit.success)
      return NextResponse.json(
        {
          error:
            "Too many requests. Use the Runpod console for urgent Pod controls.",
        },
        { status: 429, headers: { ...headers, ...rateLimitHeaders(limit) } },
      );
    if (input.action === "quote")
      return json({ pod: await quoteRunpodPod(auth.user.id, input) }, 201);
    if (input.action === "launch")
      return json({ pod: await launchRunpodPod(auth.user.id, input.id) }, 202);
    if (input.action === "reveal_key")
      return json(await revealRunpodApiKey(auth.user.id, input.id));
    return json({
      pod: await operateRunpodPod(
        auth.user.id,
        input.id,
        input.action,
        input.action === "resume" ? input.maxGpuPricePerHour : undefined,
      ),
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return json({ error: "Invalid JSON" }, 400);
    return failure(error);
  }
}
