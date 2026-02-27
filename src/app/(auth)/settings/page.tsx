import type { Metadata } from "next";
import SettingsForm from "./settings-form";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your AI Market Cap account settings and preferences.",
};

export default function SettingsPage() {
  return <SettingsForm />;
}
