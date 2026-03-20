"use client";

export function AmbientScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-45"
    >
      <div
        className="absolute left-[-12%] top-[6%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(0,212,170,0.18),transparent_68%)] blur-3xl"
        style={{ animation: "ambient-drift 18s ease-in-out infinite" }}
      />
      <div
        className="absolute right-[-10%] top-[18%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(93,224,255,0.12),transparent_70%)] blur-3xl"
        style={{ animation: "ambient-drift 24s ease-in-out infinite reverse" }}
      />
      <div
        className="absolute bottom-[-12%] left-[20%] h-[18rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_74%)] blur-3xl"
        style={{ animation: "ambient-drift 22s ease-in-out infinite 1.5s" }}
      />
    </div>
  );
}
