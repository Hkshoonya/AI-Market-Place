import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?redirect=%2Fadmin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin, is_banned")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin || profile.is_banned) {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}
