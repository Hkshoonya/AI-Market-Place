/**
 * MCP Prompts -- Prompt templates for AI-assisted interactions
 */

import type { McpPrompt } from "./types";

export const MCP_PROMPTS: McpPrompt[] = [
  {
    name: "compare_models",
    description: "Compare two AI models side-by-side on key metrics",
    arguments: [
      { name: "model_a", description: "First model slug", required: true },
      { name: "model_b", description: "Second model slug", required: true },
    ],
  },
  {
    name: "recommend_model",
    description: "Get a model recommendation for a specific use case",
    arguments: [
      { name: "use_case", description: "Description of the use case", required: true },
      { name: "constraints", description: "Budget, latency, or other constraints", required: false },
    ],
  },
];

/** Generate a prompt by name */
export async function generatePrompt(
  supabase: unknown,
  name: string,
  args: Record<string, unknown>
): Promise<{ messages: { role: string; content: string }[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  switch (name) {
    case "compare_models": {
      const slugA = args.model_a as string;
      const slugB = args.model_b as string;
      if (!slugA || !slugB) throw new Error("model_a and model_b are required");

      const { data: modelA } = await sb
        .from("models")
        .select("name, provider, category, quality_score, hf_downloads, parameter_count, context_window, is_open_weights, license")
        .eq("slug", slugA)
        .single();

      const { data: modelB } = await sb
        .from("models")
        .select("name, provider, category, quality_score, hf_downloads, parameter_count, context_window, is_open_weights, license")
        .eq("slug", slugB)
        .single();

      if (!modelA || !modelB) throw new Error("One or both models not found");

      return {
        messages: [
          {
            role: "user",
            content: `Compare these two AI models:\n\nModel A: ${JSON.stringify(modelA, null, 2)}\n\nModel B: ${JSON.stringify(modelB, null, 2)}\n\nProvide a detailed comparison covering: performance, cost, capabilities, and which one is better for different use cases.`,
          },
        ],
      };
    }

    case "recommend_model": {
      const useCase = args.use_case as string;
      if (!useCase) throw new Error("use_case is required");

      const { data: topModels } = await sb
        .from("models")
        .select("name, slug, provider, category, quality_score, is_open_weights, license")
        .eq("status", "active")
        .not("quality_score", "is", null)
        .order("quality_score", { ascending: false })
        .limit(20);

      return {
        messages: [
          {
            role: "user",
            content: `Based on the following use case, recommend the best AI model:\n\nUse case: ${useCase}\n${args.constraints ? `Constraints: ${args.constraints}` : ""}\n\nAvailable top models:\n${JSON.stringify(topModels ?? [], null, 2)}\n\nRecommend the best model with reasoning.`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
