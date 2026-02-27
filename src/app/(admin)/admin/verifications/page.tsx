"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function AdminVerificationsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?status=${statusFilter}`);
      const json = await res.json();
      if (res.ok) {
        setRequests(json.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          action,
          admin_notes: adminNotes[requestId] || "",
        }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const statusCounts: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-neon" />
          Seller Verifications
        </h2>
      </div>

      {/* Status filters */}
      <div className="flex gap-1">
        {Object.entries(statusCounts).map(([key, label]) => (
          <Button
            key={key}
            variant={statusFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(key)}
            className={statusFilter === key ? "bg-neon text-background hover:bg-neon/90" : ""}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Requests */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-secondary" />
          ))
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card px-6 py-12 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              No {statusFilter} verification requests
            </p>
          </div>
        ) : (
          requests.map((req) => {
            const profile = req.profiles;
            return (
              <Card key={req.id} className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {req.business_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        by {profile?.display_name || profile?.username || "Unknown"}{" "}
                        {profile?.username && (
                          <span className="text-muted-foreground/60">@{profile.username}</span>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        req.status === "pending"
                          ? "border-amber-500/30 text-amber-500"
                          : req.status === "approved"
                          ? "border-gain/30 text-gain"
                          : "border-loss/30 text-loss"
                      }
                    >
                      {req.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {req.status === "approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {req.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                      {req.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {req.business_description && (
                    <p className="text-sm text-muted-foreground">
                      {req.business_description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {req.website_url && (
                      <a
                        href={req.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neon hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                      </a>
                    )}
                    {req.portfolio_url && (
                      <a
                        href={req.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neon hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Portfolio
                      </a>
                    )}
                    <span className="text-muted-foreground">
                      Submitted {formatDate(req.created_at)}
                    </span>
                  </div>

                  {req.reason && (
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">
                        Reason for verification
                      </p>
                      <p className="text-sm">{req.reason}</p>
                    </div>
                  )}

                  {/* Admin actions */}
                  {req.status === "pending" && (
                    <div className="space-y-3 pt-2 border-t border-border/30">
                      <Input
                        placeholder="Admin notes (optional)..."
                        value={adminNotes[req.id] || ""}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="bg-secondary text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-2 bg-gain text-background hover:bg-gain/90"
                          onClick={() => handleAction(req.id, "approve")}
                          disabled={actionLoading === req.id}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {actionLoading === req.id ? "Processing..." : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-loss/30 text-loss hover:bg-loss/10"
                          onClick={() => handleAction(req.id, "reject")}
                          disabled={actionLoading === req.id}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Show admin notes for processed requests */}
                  {req.status !== "pending" && req.admin_notes && (
                    <div className="rounded-lg bg-secondary/30 p-3">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">
                        Admin notes
                      </p>
                      <p className="text-sm">{req.admin_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
