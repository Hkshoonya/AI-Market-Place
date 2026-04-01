import type { Metadata } from "next";
import StartContent from "./start-content";

export const metadata: Metadata = {
  title: "Start Deployment",
  description: "Start a deploy or access flow for a model from AI Market Cap.",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return <StartContent />;
}
