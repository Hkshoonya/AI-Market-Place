"use client";

export function MarketplaceHeroScene() {
  return (
    <div
      data-testid="marketplace-hero-scene"
      className="relative min-h-[260px] overflow-hidden rounded-[28px] border border-border/50 bg-[radial-gradient(circle_at_20%_20%,rgba(0,212,170,0.18),transparent_28%),radial-gradient(circle_at_75%_22%,rgba(93,224,255,0.14),transparent_24%),linear-gradient(180deg,rgba(11,18,16,0.96),rgba(5,9,8,0.98))]"
    >
      <div className="absolute inset-0 opacity-80">
        <div
          className="absolute left-[8%] top-[18%] h-20 w-20 rounded-full border border-neon/30 bg-neon/12 blur-[1px]"
          style={{ animation: "marketplace-float 7s ease-in-out infinite" }}
        />
        <div
          className="absolute right-[10%] top-[16%] h-16 w-16 rounded-2xl border border-cyan-300/30 bg-cyan-300/10"
          style={{ animation: "marketplace-float 6.2s ease-in-out infinite 0.8s" }}
        />
        <div
          className="absolute left-[26%] top-[28%] h-2 w-[48%] rounded-full bg-[linear-gradient(90deg,rgba(0,212,170,0.15),rgba(215,255,246,0.9),rgba(93,224,255,0.18))]"
          style={{ animation: "marketplace-pulse-beam 3.2s ease-in-out infinite" }}
        />
        <div
          className="absolute left-[32%] top-[20%] h-4 w-4 rounded-md border border-neon/20 bg-neon/20"
          style={{ animation: "marketplace-orbit 8s linear infinite" }}
        />
        <div
          className="absolute left-[58%] top-[54%] h-5 w-5 rounded-md border border-cyan-300/20 bg-cyan-300/15"
          style={{ animation: "marketplace-orbit 9s linear infinite reverse" }}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-between px-8 py-6">
        <div
          className="relative flex w-[34%] min-w-[120px] max-w-[170px] flex-col items-center"
          style={{ animation: "marketplace-float 6s ease-in-out infinite" }}
        >
          <div className="h-14 w-14 rounded-full border border-neon/35 bg-neon/12 shadow-[0_0_40px_rgba(0,212,170,0.18)]" />
          <div className="mt-3 h-24 w-16 rounded-[28px] border border-neon/25 bg-[linear-gradient(180deg,rgba(15,31,27,0.95),rgba(6,15,12,1))]" />
          <div className="mt-4 text-center text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Human
          </div>
        </div>

        <div className="relative flex w-[18%] items-center justify-center">
          <div className="h-28 w-4 rounded-full bg-[linear-gradient(180deg,rgba(215,255,246,0.1),rgba(215,255,246,0.95),rgba(215,255,246,0.08))] shadow-[0_0_30px_rgba(215,255,246,0.35)]" />
          <div
            className="absolute h-20 w-20 rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(215,255,246,0.26),transparent_68%)]"
            style={{ animation: "marketplace-handshake-ring 4s ease-in-out infinite" }}
          />
        </div>

        <div
          className="relative flex w-[34%] min-w-[120px] max-w-[170px] flex-col items-center"
          style={{ animation: "marketplace-float 6.4s ease-in-out infinite 0.6s" }}
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_38px_rgba(93,224,255,0.12)]">
            <div className="grid grid-cols-2 gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
            </div>
          </div>
          <div className="mt-3 h-24 w-20 rounded-[24px] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(7,19,24,0.95),rgba(5,11,16,1))]" />
          <div className="mt-4 text-center text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Agent
          </div>
        </div>
      </div>
    </div>
  );
}
