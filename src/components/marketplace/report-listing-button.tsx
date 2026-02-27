"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

const REASONS = [
  "Spam or misleading",
  "Inappropriate content",
  "Copyright infringement",
  "Scam or fraud",
  "Other",
];

interface ReportListingButtonProps {
  listingSlug: string;
}

export function ReportListingButton({ listingSlug }: ReportListingButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!user) return null;

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/marketplace/listings/${listingSlug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Report submitted. Thank you." });
        setReason("");
        setDetails("");
        setTimeout(() => setOpen(false), 2000);
      } else {
        const json = await res.json();
        setMessage({ type: "error", text: json.error || "Failed to submit report" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-loss"
        onClick={() => setOpen(!open)}
      >
        <Flag className="h-3.5 w-3.5" />
        Report
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border/50 bg-card p-4 shadow-lg">
          <h3 className="text-sm font-semibold mb-3">Report this listing</h3>

          <div className="space-y-2 mb-3">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-[#00d4aa]"
                />
                <span className="text-sm">{r}</span>
              </label>
            ))}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Additional details (optional)"
            rows={2}
            className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-neon/30"
          />

          {message && (
            <p className={`text-xs mb-2 ${message.type === "success" ? "text-gain" : "text-loss"}`}>
              {message.text}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-loss text-white hover:bg-loss/90"
              onClick={handleSubmit}
              disabled={submitting || !reason}
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Submit Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
