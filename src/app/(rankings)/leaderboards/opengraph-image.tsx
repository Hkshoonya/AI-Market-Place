import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "AI Model Leaderboards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const supabase = await createClient();

  const { data: topModels } = await supabase
    .from("models")
    .select("name, provider, overall_rank, quality_score")
    .eq("status", "active")
    .not("overall_rank", "is", null)
    .order("overall_rank", { ascending: true })
    .limit(3);

  const models = topModels ?? [];

  const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];

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

        {/* Title */}
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
            Rankings
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
            AI Model Leaderboards
          </span>
        </div>

        {/* Top 3 models */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 50,
          }}
        >
          {models.map(
            (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              model: any,
              i: number
            ) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  backgroundColor: "#111111",
                  borderRadius: 16,
                  padding: 24,
                  borderTop: `3px solid ${medals[i]}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      color: medals[i],
                      fontSize: 32,
                      fontWeight: 800,
                    }}
                  >
                    #{model.overall_rank}
                  </span>
                </div>
                <span
                  style={{
                    color: "#e8e8f0",
                    fontSize: 24,
                    fontWeight: 700,
                    marginTop: 12,
                    lineHeight: 1.2,
                  }}
                >
                  {model.name}
                </span>
                <span style={{ color: "#8888a8", fontSize: 16, marginTop: 4 }}>
                  {model.provider}
                </span>
                {model.quality_score && (
                  <span
                    style={{
                      color: "#00d4aa",
                      fontSize: 20,
                      fontWeight: 700,
                      marginTop: 12,
                    }}
                  >
                    Score: {Number(model.quality_score).toFixed(1)}
                  </span>
                )}
              </div>
            )
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
