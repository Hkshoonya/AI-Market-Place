import type { Metadata } from "next";
import DeploymentsContent from "./deployments-content";

export const metadata: Metadata = {
  title: "Deployments",
};

export default function DeploymentsPage() {
  return <DeploymentsContent />;
}
