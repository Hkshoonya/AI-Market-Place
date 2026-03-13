import { ImageResponse } from "next/og";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";

export const runtime = "edge";
export const alt = "AI Marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const supabase = createPublicClient();

  const ListingTypeSchema = z.object({ listing_type: z.string() });
  const ogResponse = await supabase
    .from("marketplace_listings")
    .select("listing_type", { count: "exact", head: false })
    .eq("status", "active");

  const allListings = parseQueryResult(ogResponse, ListingTypeSchema, "MarketplaceOGListingType");
  const totalCount = ogResponse.count ?? allListings.length;

  // Aggregate by type
  const typeCounts = new Map<string, number>();
  for (const l of allListings) {
    const type = l.listing_type as string;
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }

  const categories = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const formatType = (t: string) =>
    t
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#000000",
          padding: 60,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Top gradient accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              "linear-gradient(90deg, #00d4aa 0%, #00d4aa80 50%, transparent 100%)",
          }}
        />

        {/* Title area */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "#00d4aa",
              fontSize: 22,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            Marketplace
          </span>
          <span
            style={{
              color: "#e8e8f0",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.1,
              marginTop: 8,
            }}
          >
            AI Marketplace
          </span>
          <span style={{ color: "#8888a8", fontSize: 24, marginTop: 12 }}>
            Buy and sell AI models, APIs, datasets, and fine-tuned models
          </span>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 50,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{ color: "#8888a8", fontSize: 16, marginBottom: 4 }}
            >
              Active Listings
            </span>
            <span
              style={{ color: "#00d4aa", fontSize: 56, fontWeight: 800 }}
            >
              {totalCount}
            </span>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: 20,
              }}
            >
              <span
                style={{ color: "#8888a8", fontSize: 16, marginBottom: 12 }}
              >
                Categories
              </span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {categories.map(([type, cnt], i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      padding: "8px 16px",
                      borderRadius: 8,
                      backgroundColor: "#111111",
                      color: "#e8e8f0",
                      fontSize: 18,
                      gap: 8,
                    }}
                  >
                    <span>{formatType(type)}</span>
                    <span style={{ color: "#00d4aa" }}>{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "absolute",
            bottom: 40,
            left: 60,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "#00d4aa20",
              alignItems: "center",
              justifyContent: "center",
              color: "#00d4aa",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            AI
          </div>
          <span style={{ color: "#8888a8", fontSize: 18 }}>AI Market Cap</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
