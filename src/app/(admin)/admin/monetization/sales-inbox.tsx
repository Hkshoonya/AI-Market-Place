"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { jsonFetcher } from "@/lib/swr/fetcher";
import { SWR_TIERS } from "@/lib/swr/config";

type LeadStatus = "new" | "read" | "replied" | "archived";
type Lead = {
  id: string; name: string; email: string; category: string;
  subject: string; message: string; status: LeadStatus; created_at: string;
};

export function SalesInbox({ onUpdate }: { onUpdate: () => void }) {
  const [status, setStatus] = useState<LeadStatus>("new");
  const [savingId, setSavingId] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR<{ data: Lead[] }>(
    `/api/admin/contact-submissions?commercial=true&limit=20&status=${status}`,
    jsonFetcher, SWR_TIERS.MEDIUM
  );

  async function updateStatus(id: string, nextStatus: LeadStatus) {
    setSavingId(id);
    try {
      const response = await fetch("/api/admin/contact-submissions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!response.ok) throw new Error("Could not update this enquiry. Please retry.");
      await mutate();
      onUpdate();
      toast.success("Enquiry status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update enquiry");
    } finally { setSavingId(null); }
  }

  return <Card className="border-border/50 bg-card/70">
    <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle className="text-lg">Sales inbox</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Data API and sponsorship enquiries. Daily monitoring flags unanswered requests after 48 hours.</p>
      </div>
      <label className="text-xs text-muted-foreground">Enquiry status
        <select aria-label="Enquiry status" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)} className="mt-1 block h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
          <option value="new">New</option><option value="read">In progress</option><option value="replied">Replied</option><option value="archived">Archived</option>
        </select>
      </label>
    </CardHeader>
    <CardContent className="space-y-4">
      {error ? <div role="alert" className="text-sm text-loss">Sales enquiries could not be loaded. <Button variant="outline" size="sm" onClick={() => void mutate()}>Retry</Button></div> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading enquiries...</p> : null}
      {!error && !isLoading && !data?.data.length ? <p className="text-sm text-muted-foreground">No {status === "read" ? "in-progress" : status} enquiries. Requests from Pricing and Contact will appear here.</p> : null}
      {(data?.data ?? []).map((lead) => <article key={lead.id} className="min-w-0 rounded-xl border border-border/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="break-words font-medium">{lead.subject}</h3>
          <time className="text-xs text-muted-foreground" dateTime={lead.created_at}>{new Date(lead.created_at).toLocaleDateString()}</time>
        </div>
        <p className="mt-1 break-words text-sm text-muted-foreground">{lead.name} / {lead.email}</p>
        <p className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">{lead.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild><a href={`mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(`Re: ${lead.subject}`)}`}>Open email reply</a></Button>
          <Button size="sm" variant="outline" disabled={savingId !== null} onClick={() => void updateStatus(lead.id, "read")}>Mark in progress</Button>
          <Button size="sm" variant="outline" disabled={savingId !== null} onClick={() => void updateStatus(lead.id, "replied")}>Mark replied</Button>
          <Button size="sm" variant="ghost" disabled={savingId !== null} onClick={() => void updateStatus(lead.id, "archived")}>Archive</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Status changes do not send email or grant paid access.</p>
      </article>)}
      {(data?.data.length ?? 0) === 20 ? <p className="text-xs text-muted-foreground">Showing the newest 20. Process these enquiries to reveal older items in this status.</p> : null}
    </CardContent>
  </Card>;
}
