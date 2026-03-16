import type {
  MarketplaceAutonomyMode,
  MarketplacePurchaseMode,
} from "@/types/database";

export interface ListingStatusPill {
  label: string;
  tone: "emerald" | "yellow" | "red" | "blue";
  description: string;
}

export interface ListingCommerceSignals {
  purchase: ListingStatusPill;
  autonomy: ListingStatusPill;
  manifest: ListingStatusPill;
  seller: ListingStatusPill;
}

interface ListingCommerceInput {
  purchase_mode?: MarketplacePurchaseMode | string | null;
  autonomy_mode?: MarketplaceAutonomyMode | string | null;
  preview_manifest?: Record<string, unknown> | null;
  mcp_manifest?: Record<string, unknown> | null;
  agent_config?: Record<string, unknown> | null;
  agent_id?: string | null;
}

const TONE_CLASSES: Record<ListingStatusPill["tone"], string> = {
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  yellow: "border-yellow-400/30 bg-yellow-500/10 text-yellow-300",
  red: "border-red-400/30 bg-red-500/15 text-red-300",
  blue: "border-blue-400/30 bg-blue-500/10 text-blue-300",
};

export function getListingPillClasses(tone: ListingStatusPill["tone"]): string {
  return TONE_CLASSES[tone];
}

function getPurchaseSignal(
  purchaseMode: MarketplacePurchaseMode | string | null | undefined
): ListingStatusPill {
  switch (purchaseMode) {
    case "purchase_blocked":
      return {
        label: "Purchase Blocked",
        tone: "red",
        description: "This listing is not currently purchasable.",
      };
    case "manual_review_required":
      return {
        label: "Review Before Purchase",
        tone: "yellow",
        description: "A human must review or approve the order before it can proceed.",
      };
    default:
      return {
        label: "Public Purchase",
        tone: "emerald",
        description: "Eligible buyers can place orders without extra review gates.",
      };
  }
}

function getAutonomySignal(
  autonomyMode: MarketplaceAutonomyMode | string | null | undefined
): ListingStatusPill {
  switch (autonomyMode) {
    case "autonomous_blocked":
      return {
        label: "Human Only",
        tone: "red",
        description: "Autonomous API-key buyers are blocked for this listing.",
      };
    case "manual_only":
      return {
        label: "Manual Only",
        tone: "yellow",
        description: "Humans can buy this listing, but autonomous execution is not enabled.",
      };
    case "restricted":
      return {
        label: "Restricted Autonomy",
        tone: "blue",
        description: "Autonomous access exists with tighter controls or trust requirements.",
      };
    default:
      return {
        label: "Autonomous Ready",
        tone: "emerald",
        description: "This listing exposes enough machine-readable structure for autonomous buyers.",
      };
  }
}

function hasPreviewManifest(listing: ListingCommerceInput): boolean {
  return Boolean(
    listing.preview_manifest ||
      listing.mcp_manifest ||
      (listing.agent_config && typeof listing.agent_config === "object")
  );
}

export function getListingCommerceSignals(
  listing: ListingCommerceInput
): ListingCommerceSignals {
  return {
    purchase: getPurchaseSignal(listing.purchase_mode),
    autonomy: getAutonomySignal(listing.autonomy_mode),
    manifest: hasPreviewManifest(listing)
      ? {
          label: "Manifest Backed",
          tone: "blue",
          description: "The listing exposes a machine-readable preview contract for buyers and agents.",
        }
      : {
          label: "Lightweight Preview",
          tone: "yellow",
          description: "The listing is visible, but the delivery contract is still thin for machine execution.",
        },
    seller: listing.agent_id
      ? {
          label: "Agent Seller",
          tone: "emerald",
          description: "This listing is tied to an agent identity rather than only a human seller account.",
        }
      : {
          label: "Human Seller",
          tone: "blue",
          description: "This listing is published through a user-managed seller account.",
        },
  };
}
