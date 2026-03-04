import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "AI Model Details";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("models")
    .select(
      "name, provider, category, overall_rank, quality_score, parameter_count, is_open_weights, hf_downloads"
    )
    .eq("slug", slug)
    .single();

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            backgroundColor: "#000000",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          <span style={{ color: "#e8e8f0", fontSize: 48 }}>
            Model Not Found
          </span>
        </div>
      ),
      { ...size }
    );
  }

  const formatParams = (count: number) => {
    if (count >= 1e12) return `${(count / 1e12).toFixed(1)}T`;
    if (count >= 1e9) return `${(count / 1e9).toFixed(0)}B`;
    if (count >= 1e6) return `${(count / 1e6).toFixed(0)}M`;
    return count.toLocaleString();
  };

  const formatDownloads = (n: number) => {
    if (!n) return "0";
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  };

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
            background: "linear-gradient(90deg, #00d4aa 0%, #00d4aa80 50%, transparent 100%)",
          }}
        />

        {/* Header: Rank + Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {data.overall_rank && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: "#00d4aa20",
                color: "#00d4aa",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              #{data.overall_rank}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span
              style={{
                color: "#e8e8f0",
                fontSize: 48,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              {data.name}
            </span>
            <span style={{ color: "#8888a8", fontSize: 24, marginTop: 4 }}>
              by {data.provider}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 50,
          }}
        >
          {data.quality_score && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#8888a8", fontSize: 16, marginBottom: 4 }}>
                Quality Score
              </span>
              <span style={{ color: "#00d4aa", fontSize: 40, fontWeight: 800 }}>
                {Number(data.quality_score).toFixed(1)}
              </span>
            </div>
          )}
          {data.parameter_count && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#8888a8", fontSize: 16, marginBottom: 4 }}>
                Parameters
              </span>
              <span style={{ color: "#e8e8f0", fontSize: 40, fontWeight: 800 }}>
                {formatParams(data.parameter_count)}
              </span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#8888a8", fontSize: 16, marginBottom: 4 }}>
              Downloads
            </span>
            <span style={{ color: "#e8e8f0", fontSize: 40, fontWeight: 800 }}>
              {formatDownloads(data.hf_downloads)}
            </span>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
          <div
            style={{
              display: "flex",
              padding: "8px 16px",
              borderRadius: 8,
              backgroundColor: "#111111",
              color: "#e8e8f0",
              fontSize: 18,
            }}
          >
            {data.category?.replace(/_/g, " ").toUpperCase()}
          </div>
          {data.is_open_weights && (
            <div
              style={{
                display: "flex",
                padding: "8px 16px",
                borderRadius: 8,
                backgroundColor: "#16c78420",
                color: "#16c784",
                fontSize: 18,
              }}
            >
              Open Weights
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
          <span style={{ color: "#8888a8", fontSize: 18 }}>
            AI Market Cap
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
