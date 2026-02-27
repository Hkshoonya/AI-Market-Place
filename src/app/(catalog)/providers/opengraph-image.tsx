import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "AI Model Providers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: models } = await sb
    .from("models")
    .select("provider")
    .eq("status", "active");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allModels = (models as any[]) ?? [];

  // Aggregate provider counts
  const providerCounts = new Map<string, number>();
  for (const m of allModels) {
    providerCounts.set(m.provider, (providerCounts.get(m.provider) || 0) + 1);
  }

  const totalProviders = providerCounts.size;
  const topProviders = Array.from(providerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
            Directory
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
            AI Model Providers
          </span>
          <span style={{ color: "#8888a8", fontSize: 24, marginTop: 12 }}>
            {totalProviders} providers building the future of AI
          </span>
        </div>

        {/* Top providers list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 44,
          }}
        >
          {topProviders.map(([name, count], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "#111111",
                  color: "#8888a8",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <span
                style={{
                  color: "#e8e8f0",
                  fontSize: 26,
                  fontWeight: 700,
                  flex: 1,
                }}
              >
                {name}
              </span>
              <span
                style={{
                  color: "#00d4aa",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {count} {count === 1 ? "model" : "models"}
              </span>
            </div>
          ))}
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
