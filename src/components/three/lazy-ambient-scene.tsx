"use client";

import dynamic from "next/dynamic";

const AmbientScene = dynamic(
  () =>
    import("@/components/three/ambient-scene").then((mod) => mod.AmbientScene),
  { ssr: false }
);

export function LazyAmbientScene() {
  return <AmbientScene />;
}
