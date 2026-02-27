import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Compare AI Models";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
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
            Tool
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
            Compare AI Models
          </span>
          <span style={{ color: "#8888a8", fontSize: 24, marginTop: 12 }}>
            Side-by-side comparison of benchmarks, pricing, and performance
          </span>
        </div>

        {/* Visual comparison concept */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 50,
            alignItems: "center",
          }}
        >
          {/* Model A placeholder */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: "#111111",
              borderRadius: 16,
              padding: 28,
              alignItems: "center",
              borderTop: "3px solid #00d4aa",
            }}
          >
            <span
              style={{
                color: "#8888a8",
                fontSize: 16,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Model A
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 80,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#00d4aa",
                }}
              />
              <div
                style={{
                  display: "flex",
                  width: 60,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#00d4aa80",
                }}
              />
              <div
                style={{
                  display: "flex",
                  width: 70,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#00d4aa60",
                }}
              />
            </div>
          </div>

          {/* VS divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#111111",
              border: "2px solid #00d4aa40",
            }}
          >
            <span
              style={{
                color: "#00d4aa",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              VS
            </span>
          </div>

          {/* Model B placeholder */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: "#111111",
              borderRadius: 16,
              padding: 28,
              alignItems: "center",
              borderTop: "3px solid #8888a8",
            }}
          >
            <span
              style={{
                color: "#8888a8",
                fontSize: 16,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Model B
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 65,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#8888a8",
                }}
              />
              <div
                style={{
                  display: "flex",
                  width: 75,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#8888a880",
                }}
              />
              <div
                style={{
                  display: "flex",
                  width: 50,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#8888a860",
                }}
              />
            </div>
          </div>
        </div>

        {/* Feature labels */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 32,
            justifyContent: "center",
          }}
        >
          {["Quality", "Speed", "Price", "Benchmarks"].map((label, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                padding: "8px 20px",
                borderRadius: 8,
                backgroundColor: "#111111",
                color: "#8888a8",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {label}
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
