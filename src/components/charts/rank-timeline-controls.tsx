"use client";

interface RankTimelineControlsProps {
  metric: "rank" | "score";
  setMetric: (m: "rank" | "score") => void;
  days: number;
  setDays: (d: number) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  onAddSlug: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function RankTimelineControls({
  metric,
  setMetric,
  days,
  setDays,
  inputValue,
  setInputValue,
  onAddSlug,
  onKeyDown,
}: RankTimelineControlsProps) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h3
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Rank Timeline
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              margin: "4px 0 0",
            }}
          >
            Track how models {metric === "rank" ? "rank" : "score"} over time
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Metric toggle */}
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {(["rank", "score"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                  background: metric === m ? "rgba(255,255,255,0.1)" : "transparent",
                  color: metric === m ? "#fff" : "rgba(255,255,255,0.5)",
                  fontWeight: metric === m ? 600 : 400,
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Days selector */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              padding: "6px 10px",
              fontSize: 13,
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* Add model input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add model slug..."
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 13,
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            outline: "none",
          }}
        />
        <button
          onClick={onAddSlug}
          disabled={!inputValue.trim()}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            background: inputValue.trim() ? "#00d4aa" : "rgba(255,255,255,0.05)",
            color: inputValue.trim() ? "#000" : "rgba(255,255,255,0.3)",
            border: "none",
            borderRadius: 6,
            cursor: inputValue.trim() ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          Add
        </button>
      </div>
    </>
  );
}
