"use client";

import useSWR from "swr";
import { toast } from "sonner";
import { Flag, MessageSquareWarning, RotateCcw, ShieldBan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AdminSocialReportItem {
  id: string;
  reason: string;
  status: string;
  automation_state: string;
  classifier_confidence?: number | null;
  created_at: string;
  post: {
    id: string;
    content: string;
    status: string;
  } | null;
  thread: {
    id: string;
    title: string | null;
  } | null;
  reporter: {
    id: string;
    display_name: string | null;
    handle: string | null;
  } | null;
  target: {
    id: string;
    display_name: string | null;
    handle: string | null;
  } | null;
}

interface AdminSocialReportsResponse {
  reports: AdminSocialReportItem[];
}

export default function AdminSocialPage() {
  const { data, isLoading, mutate } = useSWR<AdminSocialReportsResponse>(
    "/api/admin/social/reports"
  );

  const reports = data?.reports ?? [];

  async function runAction(reportId: string, action: "dismiss" | "remove" | "restore") {
    try {
      const response = await fetch(`/api/admin/social/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update report");
      }

      toast.success("Moderation action applied");
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update report");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquareWarning className="h-5 w-5 text-neon" />
            Social Moderation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review auto-triaged reports, preserve thread continuity, and resolve ambiguous cases.
          </p>
        </div>
        <Badge className="border-neon/30 bg-neon/10 text-neon">{reports.length} reports</Badge>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Thread</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Reporter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Target</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Reason</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Automation</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-b border-border/30">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Flag className="h-10 w-10 text-muted-foreground/40" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          No social moderation reports
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          New reports and bot escalations will appear here.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((report) => {
                  const postIsPublished = report.post?.status === "published";
                  return (
                    <tr
                      key={report.id}
                      className="border-b border-border/30 align-top transition-colors hover:bg-secondary/10"
                    >
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {report.thread?.title || "Untitled thread"}
                          </div>
                          <p className="max-w-xl text-xs text-muted-foreground">
                            {report.post?.content || "Post missing"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {report.reporter?.display_name || report.reporter?.handle || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {report.target?.display_name || report.target?.handle || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="outline">{report.reason}</Badge>
                      </td>
                      <td className="px-4 py-4 text-center text-xs">
                        <div className="space-y-1">
                          <div className="font-medium">{report.automation_state}</div>
                          {typeof report.classifier_confidence === "number" ? (
                            <div className="text-muted-foreground">
                              {(report.classifier_confidence * 100).toFixed(0)}%
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="secondary">{report.status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {postIsPublished ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void runAction(report.id, "remove")}
                            >
                              <ShieldBan className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void runAction(report.id, "restore")}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void runAction(report.id, "dismiss")}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
