import type { Metadata } from "next";
import PodsContent from "./pods-content";

export const metadata: Metadata = {
  title: "GPU Pods",
  robots: { index: false, follow: false },
};

export default function PodsPage() {
  return <PodsContent />;
}
