import {
  Key,
  Package,
  Code,
  Database,
  FileText,
  Bot,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { ListingType, MarketplacePricingType } from "@/types/database";

export interface ListingTypeConfig {
  slug: ListingType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

export const LISTING_TYPES: ListingTypeConfig[] = [
  {
    slug: "api_access",
    label: "API Access",
    shortLabel: "API",
    icon: Key,
    description: "Access models via API endpoints",
    color: "#00d4aa",
  },
  {
    slug: "model_weights",
    label: "Model Weights",
    shortLabel: "Weights",
    icon: Package,
    description: "Download pre-trained model weights",
    color: "#f59e0b",
  },
  {
    slug: "fine_tuned_model",
    label: "Fine-tuned Models",
    shortLabel: "Fine-tuned",
    icon: Code,
    description: "Task-specific fine-tuned models",
    color: "#ec4899",
  },
  {
    slug: "dataset",
    label: "Datasets",
    shortLabel: "Dataset",
    icon: Database,
    description: "Training and evaluation datasets",
    color: "#8b5cf6",
  },
  {
    slug: "prompt_template",
    label: "Prompt Templates",
    shortLabel: "Prompts",
    icon: FileText,
    description: "Optimized prompt libraries",
    color: "#06b6d4",
  },
  {
    slug: "agent",
    label: "AI Agents",
    shortLabel: "Agent",
    icon: Bot,
    description: "Autonomous AI agents and bots",
    color: "#10b981",
  },
  {
    slug: "mcp_server",
    label: "MCP Servers",
    shortLabel: "MCP",
    icon: Server,
    description: "Model Context Protocol server endpoints",
    color: "#3b82f6",
  },
];

export const LISTING_TYPE_MAP: Record<ListingType, ListingTypeConfig> =
  Object.fromEntries(LISTING_TYPES.map((t) => [t.slug, t])) as Record<ListingType, ListingTypeConfig>;

export const PRICING_TYPE_LABELS: Record<MarketplacePricingType, string> = {
  one_time: "One-time Purchase",
  monthly_subscription: "Monthly Subscription",
  per_token: "Per Token",
  per_request: "Per Request",
  free: "Free",
  contact: "Contact for Pricing",
};

export type MarketplaceSortOption = "newest" | "price_asc" | "price_desc" | "rating" | "popular";

export const MARKETPLACE_SORT_OPTIONS: { value: MarketplaceSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low" },
  { value: "price_desc", label: "Price: High" },
  { value: "rating", label: "Rating" },
  { value: "popular", label: "Popular" },
];
