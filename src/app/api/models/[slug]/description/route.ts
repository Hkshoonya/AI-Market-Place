import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { buildFallbackOverview } from "@/lib/models/presentation";

export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const supabase = await createClient();

    // Get model
    const { data: modelRaw } = await supabase
      .from("models")
      .select("id, slug, name, provider, category, description, short_description, is_open_weights, context_window, capabilities")
      .eq("slug", slug)
      .single();

    if (!modelRaw) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Get description
    const { data: description } = await supabase
      .from("model_descriptions")
      .select("*")
      .eq("model_id", modelRaw.id)
      .single();

    return NextResponse.json(description ?? buildFallbackOverview(modelRaw));
  } catch (err) {
    return handleApiError(err, "api/models/description");
  }
}
