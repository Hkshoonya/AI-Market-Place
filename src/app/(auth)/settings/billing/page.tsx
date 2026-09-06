import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillingContent } from "./billing-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Data API Billing", robots: { index: false, follow: false } };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login?redirect=%2Fsettings%2Fbilling");
  return <BillingContent returned={(await searchParams).checkout === "returned"} />;
}
