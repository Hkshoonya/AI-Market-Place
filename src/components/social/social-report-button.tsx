"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "illegal_goods", label: "Illegal goods" },
  { value: "malware", label: "Malware or credential theft" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
] as const;

interface SocialReportButtonProps {
  postId: string;
}

export function SocialReportButton({ postId }: SocialReportButtonProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [isSubmitting, startTransition] = useTransition();
  const reasonId = useId();
  const detailsId = useId();

  if (loading || !user) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch(`/api/social/posts/${postId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to submit report");
      }

      toast.success("Report submitted");
      setDetails("");
      setReason("spam");
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit report");
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Report
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-border/50 bg-background/70 p-3"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-[0.16em]" htmlFor={reasonId}>
          Reason
        </label>
        <select
          id={reasonId}
          className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          value={reason}
          onChange={(event) =>
            setReason(event.target.value as (typeof REPORT_REASONS)[number]["value"])
          }
        >
          {REPORT_REASONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-[0.16em]" htmlFor={detailsId}>
          Details
        </label>
        <textarea
          id={detailsId}
          className="border-input placeholder:text-muted-foreground dark:bg-input/30 min-h-20 w-full rounded-xl border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Optional context for moderators"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={1000}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Submit report"}
        </Button>
      </div>
    </form>
  );
}
