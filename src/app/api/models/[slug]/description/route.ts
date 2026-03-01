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
    .select("id")
    .eq("slug", slug)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = modelRaw as any;

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Get description
  const { data: description } = await supabase
    .from("model_descriptions" as any)
    .select("*")
    .eq("model_id", model.id)
    .single();

  if (!description) {
    return NextResponse.json({ error: "No description available" }, { status: 404 });
  }

  return NextResponse.json(description);
}
