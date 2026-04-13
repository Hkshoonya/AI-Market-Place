import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants/site";

export const ROOT_SOCIAL_IMAGE_ALT =
  "AI Market Cap with AI model rankings, benchmarks, pricing, and marketplace signals";
export const ROOT_SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 };

export function renderRootSocialImage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at top left, rgba(0, 212, 170, 0.22), transparent 38%), linear-gradient(180deg, #05070c 0%, #000000 100%)",
        color: "#f4f7fb",
        padding: "58px 64px",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 212, 170, 0.12)",
            color: "#00d4aa",
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          AI
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              color: "#00d4aa",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 2.8,
              textTransform: "uppercase",
            }}
          >
            Discovery
          </span>
          <span
            style={{
              color: "#a9b4c6",
              fontSize: 18,
            }}
          >
            Benchmarks, pricing, deployability, and marketplace signals
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 48,
          maxWidth: 880,
        }}
      >
        <span
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -2.4,
          }}
        >
          {SITE_NAME}
        </span>
        <span
          style={{
            marginTop: 18,
            color: "#d2d7e3",
            fontSize: 28,
            lineHeight: 1.25,
          }}
        >
          {SITE_DESCRIPTION}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 42,
          flexWrap: "wrap",
        }}
      >
        {["Leaderboards", "Compare Models", "Deployment Paths", "Marketplace Data"].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 18px",
              borderRadius: 999,
              backgroundColor: "rgba(17, 23, 33, 0.92)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#eef2f8",
              fontSize: 20,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 210,
            padding: "18px 20px",
            borderRadius: 20,
            backgroundColor: "rgba(17, 23, 33, 0.94)",
            borderTop: "3px solid #00d4aa",
          }}
        >
          <span style={{ color: "#8f9cb0", fontSize: 16 }}>Structured where possible</span>
          <span style={{ color: "#f4f7fb", fontSize: 24, fontWeight: 700, marginTop: 8 }}>
            Honest evidence labels
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 210,
            padding: "18px 20px",
            borderRadius: 20,
            backgroundColor: "rgba(17, 23, 33, 0.94)",
            borderTop: "3px solid rgba(255,255,255,0.24)",
          }}
        >
          <span style={{ color: "#8f9cb0", fontSize: 16 }}>Built for sharing</span>
          <span style={{ color: "#f4f7fb", fontSize: 24, fontWeight: 700, marginTop: 8 }}>
            Rich cards across search and social
          </span>
        </div>
      </div>
    </div>
  );
}
