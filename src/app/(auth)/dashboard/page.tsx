import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import DashboardContent from "./dashboard-content";

export const metadata: Metadata = {
  title: "Account Dashboard",
  description: "Manage your AI Market Cap products, usage, and next steps.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?redirect=%2Fdashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .single();

  if (profile?.is_banned) redirect("/");

  return <DashboardContent />;
}
