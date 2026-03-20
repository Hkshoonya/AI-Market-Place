import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#050505",
          borderRadius: 16,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "3px solid rgba(0, 212, 170, 0.35)",
            borderRadius: 16,
            inset: 4,
            position: "absolute",
          }}
        />
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 29L15 21L21 25L31 13L37 17"
            stroke="#00D4AA"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="15" cy="21" r="3" fill="#00D4AA" />
          <circle cx="21" cy="25" r="3" fill="#00D4AA" />
          <circle cx="31" cy="13" r="3" fill="#00D4AA" />
          <path
            d="M8 35H36"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size
  );
}
