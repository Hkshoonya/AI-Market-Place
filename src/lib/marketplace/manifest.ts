type ListingLike = {
  id: string;
  slug: string;
  title: string;
  description: string;
  short_description?: string | null;
  listing_type: string;
  pricing_type?: string | null;
  price?: number | string | null;
  currency?: string | null;
  documentation_url?: string | null;
  demo_url?: string | null;
  tags?: string[] | null;
  agent_config?: Record<string, unknown> | null;
  mcp_manifest?: Record<string, unknown> | null;
  preview_manifest?: Record<string, unknown> | null;
};

type OrderLike = {
  id: string;
  listing_id: string;
  buyer_id: string | null;
  seller_id: string;
  created_at: string;
  price_at_time?: number | string | null;
};

type ManifestRecord = Record<string, unknown>;

function asObject(value: unknown): ManifestRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ManifestRecord)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numericPrice(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

function inferFulfillmentType(listing: ListingLike) {
  if (listing.listing_type === "mcp_server") return "mcp_endpoint";
  if (listing.listing_type === "api_access") return "api_access_grant";
  if (listing.listing_type === "prompt_template") return "prompt_content";
  if (
    listing.listing_type === "dataset" ||
    listing.listing_type === "model_weights" ||
    listing.listing_type === "fine_tuned_model"
  ) {
    return "downloadable_artifact";
  }
  if (listing.listing_type === "agent") return "agent_package";
  return "manual_delivery";
}

function extractSkillManifest(listing: ListingLike) {
  const agentConfig = asObject(listing.agent_config);
  return asObject(agentConfig?.skill_manifest);
}

function buildPricingModel(listing: ListingLike, overridePrice?: number | string | null) {
  return {
    model: listing.pricing_type ?? "one_time",
    price: overridePrice !== undefined ? numericPrice(overridePrice) : numericPrice(listing.price),
    currency: listing.currency ?? "USD",
  };
}

export function buildListingPreviewManifest(listing: ListingLike): ManifestRecord {
  const explicitPreview = asObject(listing.preview_manifest);
  if (explicitPreview) {
    return {
      schema_version: "1.0",
      ...explicitPreview,
      title: explicitPreview.title ?? listing.title,
      summary:
        explicitPreview.summary ?? listing.short_description ?? listing.description,
      pricing_model:
        asObject(explicitPreview.pricing_model) ?? buildPricingModel(listing),
    };
  }

  const skillManifest = extractSkillManifest(listing);
  if (skillManifest) {
    return {
      schema_version: "1.0",
      listing_type: listing.listing_type,
      fulfillment_type: "agent_package",
      title: String(skillManifest.name ?? listing.title),
      summary: listing.short_description ?? listing.description,
      capabilities: asStringArray(skillManifest.capabilities),
      runtime: {
        environment:
          typeof skillManifest.runtime === "string" ? skillManifest.runtime : "managed",
      },
      pricing_model: buildPricingModel(listing),
      verification: {
        source: "skill_manifest",
      },
    };
  }

  const mcpManifest = asObject(listing.mcp_manifest);
  if (mcpManifest) {
    const tools = Array.isArray(mcpManifest.tools)
      ? (mcpManifest.tools as unknown[])
          .map((tool) => asObject(tool)?.name)
          .filter((toolName): toolName is string => typeof toolName === "string")
      : [];

    return {
      schema_version: "1.0",
      listing_type: listing.listing_type,
      fulfillment_type: "mcp_endpoint",
      title: listing.title,
      summary: listing.short_description ?? listing.description,
      capabilities: tools,
      runtime: { environment: "remote" },
      access: {
        endpoint:
          typeof mcpManifest.endpoint === "string" ? mcpManifest.endpoint : null,
      },
      pricing_model: buildPricingModel(listing),
      verification: {
        source: "mcp_manifest",
      },
    };
  }

  return {
    schema_version: "1.0",
    listing_type: listing.listing_type,
    fulfillment_type: inferFulfillmentType(listing),
    title: listing.title,
    summary: listing.short_description ?? listing.description,
    capabilities: listing.tags ?? [],
    runtime: {
      environment: "managed",
    },
    pricing_model: buildPricingModel(listing),
    verification: {
      source: "listing_metadata",
    },
  };
}

export function buildOrderFulfillmentManifest(input: {
  listing: ListingLike;
  order: OrderLike;
}): ManifestRecord {
  const preview = buildListingPreviewManifest(input.listing);

  return {
    ...preview,
    schema_version: "1.0",
    order_id: input.order.id,
    listing_id: input.listing.id,
    listing_slug: input.listing.slug,
    buyer_id: input.order.buyer_id,
    seller_id: input.order.seller_id,
    purchased_at: input.order.created_at,
    pricing_model: buildPricingModel(input.listing, input.order.price_at_time),
  };
}
