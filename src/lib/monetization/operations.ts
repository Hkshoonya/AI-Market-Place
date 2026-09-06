import "server-only";
import type { TypedSupabaseClient } from "@/types/database";

export async function getRevenueOperations(supabase: TypedSupabaseClient, now = new Date()) {
  const timestamp = now.toISOString();
  const overdueBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const renewalBefore = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const results = await Promise.all([
    supabase.from("affiliate_links").select("id", { count: "exact", head: true })
      .eq("status", "active").or(`starts_at.is.null,starts_at.lte.${timestamp}`).or(`ends_at.is.null,ends_at.gt.${timestamp}`),
    supabase.from("contact_submissions").select("id", { count: "exact", head: true })
      .in("category", ["partnership", "sponsorship"]).eq("status", "new"),
    supabase.from("contact_submissions").select("id", { count: "exact", head: true })
      .in("category", ["partnership", "sponsorship"]).in("status", ["new", "read"]).lt("created_at", overdueBefore),
    supabase.from("data_api_subscriptions").select("id", { count: "exact", head: true })
      .in("status", ["active", "trialing"]).neq("plan_slug", "free").neq("source", "stripe")
      .gt("current_period_end", timestamp).lte("current_period_end", renewalBefore),
  ]);
  for (const result of results) if (result.error) throw new Error(`Revenue monitoring unavailable: ${result.error.message}`);
  return {
    activeAffiliateLinks: results[0].count ?? 0,
    newLeads: results[1].count ?? 0,
    overdueLeads: results[2].count ?? 0,
    expiringGrants: results[3].count ?? 0,
    checkedAt: timestamp,
  };
}
