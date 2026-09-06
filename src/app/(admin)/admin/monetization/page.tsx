"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Activity,
  AlertTriangle,
  CircleDollarSign,
  ExternalLink,
  Link2,
  Pencil,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SWR_TIERS } from "@/lib/swr/config";
import { jsonFetcher } from "@/lib/swr/fetcher";
import { SalesInbox } from "./sales-inbox";

interface AffiliateResponse {
  links: Array<{
    id: string;
    destination_url: string;
    program_name: string;
    campaign_name: string | null;
    commission_details: string | null;
    disclosure_text: string;
    status: "draft" | "active" | "paused" | "invalid";
    priority: number;
    starts_at: string | null;
    ends_at: string | null;
    last_checked_at: string | null;
    last_check_status: "healthy" | "redirected" | "failed" | null;
    last_http_status: number | null;
    consecutive_failures: number;
    last_error: string | null;
    total_clicks: number;
    platform: { id: string; slug: string; name: string } | null;
    model: { id: string; slug: string; name: string } | null;
  }>;
  platforms: Array<{
    id: string;
    slug: string;
    name: string;
    type: string;
    has_affiliate: boolean;
  }>;
}

interface DataSubscriptionsResponse {
  operations: { activeAffiliateLinks: number; newLeads: number; overdueLeads: number; expiringGrants: number; checkedAt: string };
  subscriptions: Array<{
    id: string;
    user_id: string;
    plan_slug: string;
    status: string;
    source: string;
    current_period_end: string | null;
    notes: string | null;
    profile: {
      id: string;
      username: string | null;
      display_name: string | null;
      email: string | null;
    } | null;
  }>;
  plans: Array<{
    slug: string;
    name: string;
    monthly_price_cents: number;
    monthly_request_limit: number;
    rate_limit_per_minute: number;
  }>;
  users: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    email: string | null;
  }>;
}

const EMPTY_LINK_FORM = {
  platformSlug: "",
  modelSlug: "",
  destinationUrl: "",
  programName: "",
  campaignName: "",
  commissionDetails: "",
  disclosureText: "Partner-supported link",
  status: "draft" as "draft" | "active" | "paused" | "invalid",
  priority: "100",
};

function userLabel(user: DataSubscriptionsResponse["users"][number]) {
  return user.display_name || user.username || user.email || user.id;
}

function statusTone(status: string) {
  if (status === "active" || status === "healthy" || status === "redirected") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "invalid" || status === "failed" || status === "expired") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

export default function MonetizationAdminPage() {
  const {
    data: affiliateData,
    error: affiliateError,
    isLoading: affiliateLoading,
    mutate: mutateAffiliates,
  } = useSWR<AffiliateResponse>(
    "/api/admin/affiliate-links",
    jsonFetcher<AffiliateResponse>,
    { ...SWR_TIERS.MEDIUM }
  );
  const {
    data: subscriptionData,
    error: subscriptionError,
    isLoading: subscriptionLoading,
    mutate: mutateSubscriptions,
  } = useSWR<DataSubscriptionsResponse>(
    "/api/admin/data-subscriptions",
    jsonFetcher<DataSubscriptionsResponse>,
    { ...SWR_TIERS.MEDIUM }
  );
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState(EMPTY_LINK_FORM);
  const [savingLink, setSavingLink] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlan, setGrantPlan] = useState("pro");
  const [grantDays, setGrantDays] = useState("30");
  const [grantNotes, setGrantNotes] = useState("");
  const [savingGrant, setSavingGrant] = useState(false);

  useEffect(() => {
    if (!linkForm.platformSlug && affiliateData?.platforms[0]?.slug) {
      setLinkForm((current) => ({
        ...current,
        platformSlug: affiliateData.platforms[0].slug,
      }));
    }
  }, [affiliateData?.platforms, linkForm.platformSlug]);

  useEffect(() => {
    if (!grantUserId && subscriptionData?.users[0]?.id) {
      setGrantUserId(subscriptionData.users[0].id);
    }
  }, [grantUserId, subscriptionData?.users]);

  const links = affiliateData?.links ?? [];
  const activeLinks = links.filter((link) => link.status === "active").length;
  const failedLinks = links.filter(
    (link) => link.status === "invalid" || link.last_check_status === "failed"
  ).length;
  const totalClicks = links.reduce((sum, link) => sum + Number(link.total_clicks), 0);

  function resetLinkForm() {
    setEditingLinkId(null);
    setLinkForm({
      ...EMPTY_LINK_FORM,
      platformSlug: affiliateData?.platforms[0]?.slug ?? "",
    });
  }

  async function saveAffiliateLink() {
    if (!linkForm.platformSlug || !linkForm.destinationUrl || !linkForm.programName) {
      toast.error("Platform, destination URL, and program name are required");
      return;
    }

    setSavingLink(true);
    try {
      const response = await fetch("/api/admin/affiliate-links", {
        method: editingLinkId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingLinkId ? { id: editingLinkId } : {}),
          platformSlug: linkForm.platformSlug,
          modelSlug: linkForm.modelSlug.trim() || null,
          destinationUrl: linkForm.destinationUrl,
          programName: linkForm.programName,
          campaignName: linkForm.campaignName.trim() || null,
          commissionDetails: linkForm.commissionDetails.trim() || null,
          disclosureText: linkForm.disclosureText,
          status: linkForm.status,
          priority: Number(linkForm.priority),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not save affiliate link");

      toast.success(editingLinkId ? "Affiliate link updated" : "Affiliate link created");
      resetLinkForm();
      await mutateAffiliates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save affiliate link");
    } finally {
      setSavingLink(false);
    }
  }

  function editAffiliateLink(link: AffiliateResponse["links"][number]) {
    setEditingLinkId(link.id);
    setLinkForm({
      platformSlug: link.platform?.slug ?? "",
      modelSlug: link.model?.slug ?? "",
      destinationUrl: link.destination_url,
      programName: link.program_name,
      campaignName: link.campaign_name ?? "",
      commissionDetails: link.commission_details ?? "",
      disclosureText: link.disclosure_text,
      status: link.status,
      priority: String(link.priority),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateAffiliateStatus(
    id: string,
    status: "active" | "paused"
  ) {
    const response = await fetch("/api/admin/affiliate-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Could not update affiliate status");
      return;
    }
    toast.success(status === "active" ? "Link verified and activated" : "Link paused");
    await mutateAffiliates();
  }

  async function deleteAffiliateLink(id: string) {
    if (!window.confirm("Delete this affiliate link and its click aggregates?")) return;
    const response = await fetch("/api/admin/affiliate-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Could not delete affiliate link");
      return;
    }
    toast.success("Affiliate link deleted");
    await mutateAffiliates();
  }

  async function grantDataPlan() {
    if (!grantUserId || !grantPlan) return;
    setSavingGrant(true);
    try {
      const response = await fetch("/api/admin/data-subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: grantUserId,
          planSlug: grantPlan,
          status: "active",
          periodDays: grantDays ? Number(grantDays) : null,
          notes: grantNotes.trim() || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not grant data plan");
      toast.success("Data API plan granted");
      setGrantNotes("");
      await mutateSubscriptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grant data plan");
    } finally {
      setSavingGrant(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neon">Revenue operations</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Monetization control room</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Manage sales enquiries, verified referral destinations and temporary Data API subscriptions. Paid
            checkout remains disabled until the correct Stripe business account is connected.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-amber-500/30 bg-amber-500/10 text-amber-200">
          No automated paid checkout
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["New sales enquiries", subscriptionData?.operations?.newLeads],
          ["Awaiting reply over 48h", subscriptionData?.operations?.overdueLeads],
          ["Pilot grants ending within 7 days", subscriptionData?.operations?.expiringGrants],
        ].map(([label, value]) => <Card key={label} className="border-border/50 bg-card/70"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value ?? "Unavailable"}</p></CardContent></Card>)}
      </div>
      <SalesInbox onUpdate={() => { void mutateSubscriptions(); }} />
      {affiliateData && activeLinks === 0 ? <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader><CardTitle className="text-lg">Activate your first referral channel</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>No referral commissions can be attributed to AI Market Cap until your own approved link is configured. A campaign label or a generic provider link is not an affiliate agreement.</p>
          <p><a className="text-neon underline" href="https://docs.runpod.io/accounts-billing/referrals" target="_blank" rel="noopener noreferrer">Review Runpod&apos;s official referral and affiliate program</a>, obtain your unique link, then add it below. Verify current eligibility and whether rewards are credits or cash before planning revenue.</p>
          <p>The daily agent checks destinations and disables repeatedly broken links. Referral compensation never changes model ranking scores.</p>
        </CardContent>
      </Card> : null}

      {affiliateError || subscriptionError ? (
        <Card className="border-loss/30 bg-loss/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-loss" />
              <div>
                <p className="text-sm font-medium text-loss">Revenue data is incomplete</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(affiliateError instanceof Error && affiliateError.message) ||
                    (subscriptionError instanceof Error && subscriptionError.message) ||
                    "One or more revenue requests failed."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void mutateAffiliates();
                void mutateSubscriptions();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/50 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <Link2 className="h-5 w-5 text-neon" />
              <div><p className="text-xs text-muted-foreground">Active links</p><p className="text-2xl font-semibold">{activeLinks}</p></div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <Activity className="h-5 w-5 text-emerald-300" />
              <div><p className="text-xs text-muted-foreground">Tracked clicks</p><p className="text-2xl font-semibold">{totalClicks.toLocaleString()}</p></div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <CircleDollarSign className="h-5 w-5 text-amber-300" />
              <div><p className="text-xs text-muted-foreground">Needs review</p><p className="text-2xl font-semibold">{failedLinks}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">{editingLinkId ? "Edit referral link" : "Add referral link"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-xs text-muted-foreground">
              Platform
              <select value={linkForm.platformSlug} onChange={(event) => setLinkForm((current) => ({ ...current, platformSlug: event.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">
                {(affiliateData?.platforms ?? []).map((platform) => <option key={platform.id} value={platform.slug}>{platform.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">Model slug (optional)<Input value={linkForm.modelSlug} onChange={(event) => setLinkForm((current) => ({ ...current, modelSlug: event.target.value }))} placeholder="claude-sonnet-4" /></label>
            <label className="space-y-1 text-xs text-muted-foreground md:col-span-2">HTTPS referral destination<Input value={linkForm.destinationUrl} onChange={(event) => setLinkForm((current) => ({ ...current, destinationUrl: event.target.value }))} placeholder="https://provider.example/ref/..." /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Program name<Input value={linkForm.programName} onChange={(event) => setLinkForm((current) => ({ ...current, programName: event.target.value }))} placeholder="Provider partner program" /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Campaign (optional)<Input value={linkForm.campaignName} onChange={(event) => setLinkForm((current) => ({ ...current, campaignName: event.target.value }))} placeholder="Summer launch" /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Commission notes<Input value={linkForm.commissionDetails} onChange={(event) => setLinkForm((current) => ({ ...current, commissionDetails: event.target.value }))} placeholder="20% recurring" /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Disclosure<Input value={linkForm.disclosureText} onChange={(event) => setLinkForm((current) => ({ ...current, disclosureText: event.target.value }))} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Status<select value={linkForm.status} onChange={(event) => setLinkForm((current) => ({ ...current, status: event.target.value as typeof current.status }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"><option value="draft">Draft</option><option value="active">Active (health check required)</option><option value="paused">Paused</option><option value="invalid">Invalid</option></select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Priority<Input type="number" min="0" max="10000" value={linkForm.priority} onChange={(event) => setLinkForm((current) => ({ ...current, priority: event.target.value }))} /></label>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button onClick={() => void saveAffiliateLink()} disabled={savingLink} className="bg-neon text-background hover:bg-neon/90"><Save className="h-4 w-4" />{savingLink ? "Checking..." : editingLinkId ? "Save changes" : "Create link"}</Button>
              {editingLinkId ? <Button variant="outline" onClick={resetLinkForm}>Cancel</Button> : null}
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border/50 bg-secondary/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Provider / target</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Health</th><th className="px-4 py-3 text-right">Clicks</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {affiliateLoading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading referral links...</td></tr> : links.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No referral agreements configured. Direct provider links remain available without affiliate claims.</td></tr> : links.map((link) => (
                  <tr key={link.id} className="border-b border-border/30 align-top last:border-0">
                    <td className="px-4 py-3"><p className="font-medium text-white">{link.platform?.name ?? "Unknown"}</p><p className="text-xs text-muted-foreground">{link.model ? `${link.model.name} only` : "All models"}</p><Badge variant="outline" className={`mt-2 ${statusTone(link.status)}`}>{link.status}</Badge></td>
                    <td className="px-4 py-3"><p>{link.program_name}</p><p className="mt-1 text-xs text-muted-foreground">{link.commission_details || "Commission terms not recorded"}</p></td>
                    <td className="px-4 py-3"><Badge variant="outline" className={statusTone(link.last_check_status ?? "pending")}>{link.last_check_status ?? "not checked"}</Badge><p className="mt-2 text-xs text-muted-foreground">{link.last_http_status ? `HTTP ${link.last_http_status}` : "No response yet"}</p>{link.last_error ? <p className="mt-1 max-w-xs text-xs text-red-300">{link.last_error}</p> : null}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(link.total_clicks).toLocaleString()}</td>
                    <td className="max-w-xs px-4 py-3"><a href={link.destination_url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-neon hover:underline"><span className="truncate">{link.destination_url}</span><ExternalLink className="h-3 w-3 shrink-0" /></a></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => editAffiliateLink(link)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => void updateAffiliateStatus(link.id, link.status === "active" ? "paused" : "active")}>{link.status === "active" ? "Pause" : "Verify + activate"}</Button><Button variant="ghost" size="sm" className="text-red-300" onClick={() => void deleteAffiliateLink(link.id)}><Trash2 className="h-4 w-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2"><Users className="h-5 w-5 text-neon" /><h2 className="text-xl font-semibold text-white">Data API subscriptions</h2></div>
        <Card className="border-border/50 bg-card/70">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-xs text-muted-foreground xl:col-span-2">User<select value={grantUserId} onChange={(event) => setGrantUserId(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">{(subscriptionData?.users ?? []).map((user) => <option key={user.id} value={user.id}>{userLabel(user)}{user.email && user.email !== userLabel(user) ? ` (${user.email})` : ""}</option>)}</select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Plan<select value={grantPlan} onChange={(event) => setGrantPlan(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">{(subscriptionData?.plans ?? []).map((plan) => <option key={plan.slug} value={plan.slug}>{plan.name} ({Number(plan.monthly_request_limit).toLocaleString()}/mo)</option>)}</select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Grant days<Input type="number" min="1" max="3660" value={grantDays} onChange={(event) => setGrantDays(event.target.value)} /></label>
            <div className="flex items-end"><Button onClick={() => void grantDataPlan()} disabled={savingGrant || !grantUserId} className="w-full bg-neon text-background hover:bg-neon/90">{savingGrant ? "Granting..." : "Grant plan"}</Button></div>
            <label className="space-y-1 text-xs text-muted-foreground md:col-span-2 xl:col-span-5">Internal notes<Input value={grantNotes} onChange={(event) => setGrantNotes(event.target.value)} placeholder="Pilot agreement, support owner, or expiration context" /></label>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border/50 bg-secondary/30 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Ends</th><th className="px-4 py-3">Notes</th></tr></thead><tbody>{subscriptionLoading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading subscriptions...</td></tr> : (subscriptionData?.subscriptions ?? []).length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No paid or promotional data plans granted yet. All users fall back to Explorer.</td></tr> : (subscriptionData?.subscriptions ?? []).map((subscription) => <tr key={subscription.id} className="border-b border-border/30 last:border-0"><td className="px-4 py-3"><p className="font-medium text-white">{subscription.profile ? userLabel(subscription.profile) : subscription.user_id}</p><p className="text-xs text-muted-foreground">{subscription.profile?.email}</p></td><td className="px-4 py-3">{subscription.plan_slug}</td><td className="px-4 py-3"><Badge variant="outline" className={statusTone(subscription.status)}>{subscription.status}</Badge></td><td className="px-4 py-3 text-muted-foreground">{subscription.source}</td><td className="px-4 py-3 text-muted-foreground">{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "No expiry"}</td><td className="max-w-sm px-4 py-3 text-muted-foreground">{subscription.notes || "-"}</td></tr>)}</tbody></table>
          </div>
        </div>
      </section>
    </div>
  );
}
