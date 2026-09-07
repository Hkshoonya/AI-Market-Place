"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CreditCard, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BillingOverview {
  entitlement: { plan: { name: string }; usage: { requestCount: number; requestLimit: number } };
  managed: boolean;
  hold: boolean;
  status: string | null;
  periodEnd: string | null;
  plans: { slug: string; name: string; monthlyPriceCents: number; requests: number; checkoutEnabled: boolean }[];
}

export function BillingContent({ returned = false }: { returned?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<BillingOverview>("/api/data-access/billing", {
    revalidateOnFocus: false, dedupingInterval: 10_000,
  });
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (!returned) return;
    let attempts = 0;
    const timer = setInterval(() => { void mutate(); if (++attempts >= 4) clearInterval(timer); }, 15_000);
    return () => clearInterval(timer);
  }, [returned, mutate]);

  async function openBilling(kind: "checkout" | "portal", plan?: string) {
    if (pending) return;
    setPending(plan ?? kind);
    setActionError(null);
    try {
      const response = await fetch(`/api/data-access/${kind}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        ...(kind === "checkout" ? { body: JSON.stringify({ plan }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Billing request failed");
      const url = new URL(result.url);
      const host = kind === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
      if (url.protocol !== "https:" || url.hostname !== host || url.port || url.username || url.password) throw new Error("Invalid billing redirect");
      window.location.assign(url.toString());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Billing could not be opened. Please retry.");
      setPending(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-neon">Account / Data access</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Data API billing</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Manage your research and production data plan. Model inference and wallet deposits are separate.</p></div>
        <Button variant="outline" asChild><Link href="/settings/api-keys">Your API keys <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
      {returned && <p role="status" className="mt-6 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm">You returned from Checkout. Access changes only after verified payment confirmation; this page will check for an update.</p>}
      {(error || actionError) && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 p-4 text-sm">{actionError ?? "Billing could not be loaded. Verify your email and try again, or contact support."}</p>}
      {isLoading && <p role="status" className="mt-8 text-sm text-muted-foreground">Loading your billing status...</p>}
      {data && <>
        <Card className="mt-8 border-neon/20 bg-gradient-to-br from-neon/5 to-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-5 p-6">
            <div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Database className="h-4 w-4" />Current access</p>
              <h2 className="mt-2 text-2xl font-semibold">{data.entitlement.plan.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{data.entitlement.usage.requestCount.toLocaleString()} of {data.entitlement.usage.requestLimit.toLocaleString()} requests used this calendar month</p>
              {data.status && <p className="mt-2 text-sm">Subscription: {data.status.replaceAll("_", " ")}</p>}
              {data.periodEnd && <p className="mt-1 text-xs text-muted-foreground">Current billing period ends {new Date(data.periodEnd).toLocaleDateString()}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!!pending} onClick={() => { void mutate(); }}><RefreshCw className="h-4 w-4" />Refresh</Button>
              {data.managed && <Button disabled={!!pending} onClick={() => void openBilling("portal")}><CreditCard className="h-4 w-4" />Manage billing</Button>}
            </div>
          </CardContent>
        </Card>
        {data.hold && <p role="alert" className="mt-4 rounded-lg border border-amber-500/30 p-4 text-sm">Paid access is on hold pending a billing review. Contact support; purchasing again will not remove this hold.</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.plans.map((plan) => <Card key={plan.slug} className="border-border/60"><CardContent className="p-6">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-4 text-3xl font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(plan.monthlyPriceCents / 100)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
            <p className="mt-2 text-sm text-muted-foreground">{plan.requests.toLocaleString()} requests per calendar month. Provider inference is not included.</p>
            {plan.checkoutEnabled ? <Button className="mt-6 w-full" disabled={!!pending || data.status === "active" || data.status === "past_due"} onClick={() => void openBilling("checkout", plan.slug)}>{pending === plan.slug ? "Opening Checkout..." : `Subscribe to ${plan.name}`}</Button> :
              <Button className="mt-6 w-full" variant="outline" asChild><Link href={`/contact?category=partnership&subject=${encodeURIComponent(`${plan.name} pilot`)}`}>Request a pilot</Link></Button>}
          </CardContent></Card>)}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">{data.plans.some((plan) => plan.checkoutEnabled) ? "Subscriptions renew monthly until canceled. Manage billing opens Stripe to view invoices, update your payment method or cancel at the end of the billing period." : "Online subscriptions are not enabled. Pilot requests do not charge you or create a subscription."}</p>
      </>}
      <p className="mt-6 text-xs text-muted-foreground">Review our <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>. For billing questions or refunds, <Link href="/contact?category=general&subject=Data%20API%20billing" className="underline">contact support</Link>.</p>
    </div>
  );
}
