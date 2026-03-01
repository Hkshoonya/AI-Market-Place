import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get model
  const { data: modelRaw } = await supabase
    .from("models")
    .select("id, name, provider, is_open_weights")
    .eq("slug", slug)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = modelRaw as any;

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Get deployments with platform info
  const { data: deployments } = await supabase
    .from("model_deployments" as any)
    .select("*, deployment_platforms(*)")
    .eq("model_id", model.id)
    .eq("status", "available")
    .order("price_per_unit", { ascending: true });

  // Get all platforms for showing availability
  const { data: platforms } = await supabase
    .from("deployment_platforms" as any)
    .select("*")
    .order("name");

  return NextResponse.json({
    model: { id: model.id, name: model.name, provider: model.provider, is_open_weights: model.is_open_weights },
    deployments: deployments || [],
    platforms: platforms || [],
  });
}
