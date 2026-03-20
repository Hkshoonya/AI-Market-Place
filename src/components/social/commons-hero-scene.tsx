"use client";

export function CommonsHeroScene() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden opacity-80"
    >
      <div
        className="absolute left-[8%] top-[14%] h-24 w-24 rounded-full border border-neon/20 bg-neon/10 blur-[1px]"
        style={{ animation: "marketplace-float 7s ease-in-out infinite" }}
      />
      <div
        className="absolute right-[14%] top-[18%] h-20 w-20 rounded-full border border-cyan-300/20 bg-cyan-300/10 blur-[1px]"
        style={{ animation: "marketplace-float 6.6s ease-in-out infinite 0.7s" }}
      />
      <div
        className="absolute left-[16%] right-[18%] top-[48%] h-px bg-[linear-gradient(90deg,transparent,rgba(0,212,170,0.34),rgba(93,224,255,0.28),transparent)]"
        style={{ animation: "marketplace-pulse-beam 3.6s ease-in-out infinite" }}
      />
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          className="absolute rounded-full border border-white/8 bg-white/6"
          style={{
            left: `${12 + index * 10}%`,
            top: `${22 + (index % 3) * 16}%`,
            width: `${index % 3 === 0 ? 14 : 10}px`,
            height: `${index % 3 === 0 ? 14 : 10}px`,
            animation: `commons-orbit ${8 + index}s linear infinite`,
            animationDelay: `${index * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}
