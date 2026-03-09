"use client";

export const LINE_COLORS = [
  "#00d4aa",
  "#f59e0b",
  "#ec4899",
  "#4285f4",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#d4a574",
  "#ff7000",
];

export interface ModelInfo {
  slug: string;
  name: string;
  provider: string;
}

interface RankTimelineTagsProps {
  slugs: string[];
  models: ModelInfo[];
  onRemoveSlug: (slug: string) => void;
}

export function RankTimelineTags({
  slugs,
  models,
  onRemoveSlug,
}: RankTimelineTagsProps) {
  if (slugs.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 16,
      }}
    >
      {slugs.map((slug, i) => {
        const color = LINE_COLORS[i % LINE_COLORS.length];
        const modelInfo = models.find((m) => m.slug === slug);
        return (
          <div
            key={slug}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 16,
              borderLeft: `3px solid ${color}`,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              {modelInfo ? modelInfo.name : slug}
            </span>
            <button
              onClick={() => onRemoveSlug(slug)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: 14,
                lineHeight: 1,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = "rgba(255,255,255,0.3)";
              }}
              aria-label={`Remove ${slug}`}
            >
              X
            </button>
          </div>
        );
      })}
    </div>
  );
}
