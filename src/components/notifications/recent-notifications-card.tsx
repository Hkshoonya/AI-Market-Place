"use client";

import Link from "next/link";
import { Bell, ExternalLink, Package, ShoppingBag, Zap } from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/format";
import { SWR_TIERS } from "@/lib/swr/config";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  unreadCount: number;
}

const TYPE_LABELS: Record<string, { icon: typeof Bell; label: string }> = {
  marketplace: { icon: Package, label: "Marketplace" },
  order_update: { icon: ShoppingBag, label: "Orders" },
  model_update: { icon: Zap, label: "Models" },
};

export function RecentNotificationsCard() {
  const { data, isLoading } = useSWR<NotificationsResponse>(
    "/api/notifications?limit=8",
    { ...SWR_TIERS.MEDIUM }
  );

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Recent Notifications</CardTitle>
          <Badge variant="outline" className="border-neon/30 bg-neon/10 text-neon">
            {unreadCount} unread
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-border/30 p-3">
                <div className="h-4 w-1/3 rounded bg-secondary" />
                <div className="mt-2 h-3 w-2/3 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 px-4 py-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Seller inquiries, order updates, and system notes will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const typeMeta = TYPE_LABELS[notification.type] ?? {
                icon: Bell,
                label: "System",
              };
              const Icon = typeMeta.icon;

              return (
                <div
                  key={notification.id}
                  className="rounded-xl border border-border/40 bg-background/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neon/10 text-neon">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            {typeMeta.label}
                          </p>
                        </div>
                      </div>
                      {notification.message ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(notification.created_at)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {notification.is_read ? "Read" : "Needs attention"}
                    </span>
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        className="inline-flex items-center gap-1 text-xs text-neon hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
