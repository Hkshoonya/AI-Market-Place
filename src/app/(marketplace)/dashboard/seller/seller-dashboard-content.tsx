"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  LayoutDashboard,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { SellerStatsCards } from "@/components/marketplace/seller-stats-cards";
import { SellerListingsTable } from "@/components/marketplace/seller-listings-table";
import { SellerOrdersTable } from "@/components/marketplace/seller-orders-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

function VerificationBanner() {
  const { profile } = useAuth();
  const [verStatus, setVerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_description: "",
    website_url: "",
    portfolio_url: "",
    reason: "",
  });

  useEffect(() => {
    fetch("/api/marketplace/seller/verify")
      .then((r) => r.json())
      .then((data) => {
        setVerStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace/seller/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        const data = await fetch("/api/marketplace/seller/verify").then((r) => r.json());
        setVerStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  // Already verified
  if (profile?.seller_verified) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-gain/20 bg-gain/5 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-gain" />
        <div>
          <p className="text-sm font-medium text-gain">Verified Seller</p>
          <p className="text-xs text-muted-foreground">Your account is verified and trusted.</p>
        </div>
      </div>
    );
  }

  // Pending request
  if (verStatus?.request?.status === "pending") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <Clock className="h-5 w-5 text-amber-500" />
        <div>
          <p className="text-sm font-medium text-amber-500">Verification Pending</p>
          <p className="text-xs text-muted-foreground">Your verification request is being reviewed.</p>
        </div>
      </div>
    );
  }

  // Rejected
  if (verStatus?.request?.status === "rejected") {
    return (
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-loss/20 bg-loss/5 px-4 py-3">
          <XCircle className="h-5 w-5 text-loss" />
          <div className="flex-1">
            <p className="text-sm font-medium text-loss">Verification Not Approved</p>
            <p className="text-xs text-muted-foreground">
              {verStatus.request.admin_notes || "Your request was not approved. You can submit a new request."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            Reapply
          </Button>
        </div>
        {showForm && (
          <VerificationForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            submitting={submitting}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    );
  }

  // Not yet requested
  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">Get Verified</p>
          <p className="text-xs text-muted-foreground">
            Verified sellers get a badge, higher visibility, and increased trust.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-neon text-background hover:bg-neon/90"
          onClick={() => setShowForm(!showForm)}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Apply
        </Button>
      </div>
      {showForm && (
        <VerificationForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          submitting={submitting}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function VerificationForm({
  form,
  setForm,
  onSubmit,
  submitting,
  onCancel,
}: {
  form: any;
  setForm: (fn: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onCancel: () => void;
}) {
  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-neon" />
          Verification Application
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Business / Brand Name *
            </label>
            <Input
              required
              placeholder="Your business or brand name"
              value={form.business_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((p: any) => ({ ...p, business_name: e.target.value }))
              }
              className="mt-1 bg-secondary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              placeholder="Describe your business and what you sell..."
              value={form.business_description}
              onChange={(e) =>
                setForm((p: any) => ({ ...p, business_description: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-neon/50"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Website URL
              </label>
              <Input
                type="url"
                placeholder="https://example.com"
                value={form.website_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: any) => ({ ...p, website_url: e.target.value }))
                }
                className="mt-1 bg-secondary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Portfolio / GitHub
              </label>
              <Input
                type="url"
                placeholder="https://github.com/you"
                value={form.portfolio_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p: any) => ({ ...p, portfolio_url: e.target.value }))
                }
                className="mt-1 bg-secondary"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Why should you be verified?
            </label>
            <textarea
              placeholder="Tell us why you should be a verified seller..."
              value={form.reason}
              onChange={(e) =>
                setForm((p: any) => ({ ...p, reason: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-neon/50"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="gap-2 bg-neon text-background hover:bg-neon/90"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SellerDashboardContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/dashboard/seller");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetch("/api/marketplace/seller/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(console.error);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-secondary" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-secondary" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">Seller Dashboard</h1>
      </div>

      <VerificationBanner />

      {stats && <SellerStatsCards stats={stats} />}

      <div className="mt-8 space-y-8">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Your Listings</h2>
          <SellerListingsTable />
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold">Incoming Orders</h2>
          <SellerOrdersTable />
        </div>
      </div>
    </div>
  );
}
