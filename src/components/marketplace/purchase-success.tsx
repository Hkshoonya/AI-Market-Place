"use client";

import Link from "next/link";
import { CheckCircle2, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeliveryData {
  api_key?: string;
  download_url?: string;
  access_url?: string;
  instructions?: string;
  [key: string]: unknown;
}

interface PurchaseSuccessProps {
  delivery: DeliveryData;
  isFree: boolean;
  dialogTitle: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  onClose: () => void;
  showOrders: boolean;
}

export function PurchaseSuccess({
  delivery,
  isFree,
  dialogTitle,
  copiedField,
  onCopy,
  onClose,
  showOrders,
}: PurchaseSuccessProps) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <DialogTitle>{dialogTitle}</DialogTitle>
        </div>
        <DialogDescription>
          {isFree
            ? "You now have access. Here are your details:"
            : "Your purchase was successful. Here are your delivery details:"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/30 p-4">
        {delivery.api_key && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">API Key</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                {delivery.api_key}
              </code>
              <button
                onClick={() => onCopy(delivery.api_key!, "api_key")}
                aria-label="Copy API key"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {copiedField === "api_key" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {delivery.download_url && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">Download</p>
            <a
              href={delivery.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-neon hover:underline break-all"
            >
              Download File
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        )}

        {delivery.access_url && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">Access URL</p>
            <a
              href={delivery.access_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-neon hover:underline break-all"
            >
              Open Access Link
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        )}

        {delivery.instructions && (
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">Instructions</p>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {delivery.instructions}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Close
        </Button>
        {showOrders && (
          <Button asChild className="flex-1 bg-neon text-background hover:bg-neon/90">
            <Link href="/orders">View Orders</Link>
          </Button>
        )}
      </div>
    </>
  );
}
