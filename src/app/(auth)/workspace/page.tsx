import type { Metadata } from "next";
import WorkspaceContent from "./workspace-content";

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function WorkspacePage() {
  return <WorkspaceContent />;
}
