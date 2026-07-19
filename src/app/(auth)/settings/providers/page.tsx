import type { Metadata } from "next";
import ProviderConnectionsContent from "./provider-connections-content";

export const metadata: Metadata = {
  title: "Provider Connections",
  description: "Connect your AI provider accounts to AI Market Cap securely.",
};

export default function ProviderConnectionsPage() {
  return <ProviderConnectionsContent />;
}
