import type { Metadata } from "next";
import ActivityContent from "./activity-content";

export const metadata: Metadata = {
  title: "Activity",
  description: "Your recent activity on AI Market Cap.",
};

export default function ActivityPage() {
  return <ActivityContent />;
}
