import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { buildFallbackOverview, getModelDisplayDescription } from "@/lib/models/presentation";

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

    const fallbackOverview = buildFallbackOverview(modelRaw);

    // Get description
    const { data: description } = await supabase
      .from("model_descriptions")
      .select("*")
      .eq("model_id", modelRaw.id)
      .single();

    if (!description) {
      return NextResponse.json(fallbackOverview);
    }

    const preferredSummary = getModelDisplayDescription({
      ...modelRaw,
      description:
        typeof description.summary === "string" && description.summary.trim().length > 0
          ? description.summary
          : modelRaw.description,
    }).text;

    return NextResponse.json({
      ...fallbackOverview,
      ...description,
      summary: preferredSummary ?? fallbackOverview.summary,
      highlights: fallbackOverview.highlights,
      evidence_badges: [
        "Generated Overview",
        "Catalog Metadata",
      ],
      methodology: fallbackOverview.methodology,
    });
  } catch (err) {
    return handleApiError(err, "api/models/description");
  }
}
