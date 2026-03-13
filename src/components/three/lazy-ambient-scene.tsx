"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const AmbientScene = dynamic(
  () =>
    import("@/components/three/ambient-scene").then((mod) => mod.AmbientScene),
  { ssr: false }
);

export function LazyAmbientScene() {
  const pathname = usePathname();

  if (pathname !== "/") {
    return null;
  }

  return <AmbientScene />;
}
