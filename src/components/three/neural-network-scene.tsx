"use client";

export function NeuralNetworkScene() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#000000]">
      <div
        className="absolute left-[-10%] top-[8%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(0,212,170,0.16),transparent_68%)] blur-3xl"
        style={{ animation: "ambient-drift 18s ease-in-out infinite" }}
      />
      <div
        className="absolute right-[-6%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(93,224,255,0.14),transparent_70%)] blur-3xl"
        style={{ animation: "ambient-drift 24s ease-in-out infinite reverse" }}
      />
      <div
        className="absolute left-[12%] top-[36%] h-px w-[72%] bg-[linear-gradient(90deg,transparent,rgba(0,212,170,0.2),rgba(93,224,255,0.22),transparent)]"
        style={{ animation: "marketplace-pulse-beam 4s ease-in-out infinite" }}
      />
      {Array.from({ length: 11 }).map((_, index) => (
        <span
          key={index}
          className="absolute rounded-full border border-white/8 bg-white/8"
          style={{
            left: `${8 + index * 8}%`,
            top: `${20 + (index % 4) * 12}%`,
            width: `${index % 2 === 0 ? 14 : 10}px`,
            height: `${index % 2 === 0 ? 14 : 10}px`,
            animation: `commons-orbit ${7 + index}s linear infinite`,
            animationDelay: `${index * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}
