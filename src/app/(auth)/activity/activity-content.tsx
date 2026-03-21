"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { ActivityFeed } from "@/components/notifications/activity-feed";
import { RecentNotificationsCard } from "@/components/notifications/recent-notifications-card";

export default function ActivityContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/activity");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-96 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Activity Feed</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/watchlists">
            <Eye className="h-4 w-4" />
            Manage Watchlists
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 rounded-xl border border-border/50 bg-card p-4">
          <ActivityFeed maxItems={50} />
        </div>
        <RecentNotificationsCard />
      </div>
    </div>
  );
}
