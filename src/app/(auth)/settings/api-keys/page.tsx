import type { Metadata } from "next";
import ApiKeysContent from "./api-keys-content";

export const metadata: Metadata = {
  title: "API Keys",
  description: "Manage your API keys for bot and MCP access",
};

export default function ApiKeysPage() {
  return <ApiKeysContent />;
}
