import type { Metadata } from "next";
import AgentsContent from "./agents-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agents | Admin",
  description: "Monitor and manage platform agents",
  robots: { index: false, follow: false },
};

export default function AdminAgentsPage() {
  return <AgentsContent />;
}
