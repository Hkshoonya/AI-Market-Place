"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ExternalLink,
  Package,
  ShoppingBag,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/components/auth/auth-provider";
import { formatRelativeDate } from "@/lib/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  model_update: Zap,
  watchlist_change: Star,
  order_update: ShoppingBag,
  marketplace: Package,
  system: Bell,
};

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?limit=15");
      const json = await res.json();
      if (res.ok) {
        setNotifications(json.data ?? []);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } catch {
      // Fallback: check activity endpoint
      try {
        const res = await fetch("/api/activity");
        const json = await res.json();
        if (res.ok && json.data?.length > 0 && !json.isGlobal) {
          setUnreadCount(json.data.length);
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[9px] font-bold text-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-card p-0 border-border/50"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-neon hover:underline"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] ?? Bell;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/20 last:border-0 transition-colors ${
                    notif.is_read
                      ? "opacity-60"
                      : "bg-neon/[0.02]"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      notif.is_read ? "bg-secondary" : "bg-neon/10"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${notif.is_read ? "text-muted-foreground" : "text-neon"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeDate(notif.created_at)}
                      </span>
                      {notif.link && (
                        <Link
                          href={notif.link}
                          className="text-[10px] text-neon hover:underline inline-flex items-center gap-0.5"
                          onClick={() => setOpen(false)}
                        >
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {!notif.is_read && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neon" />
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <BellOff className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">
                No notifications yet
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 px-4 py-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-neon h-7"
            asChild
          >
            <Link href="/activity" onClick={() => setOpen(false)}>
              View All Activity
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            asChild
          >
            <Link href="/settings" onClick={() => setOpen(false)}>
              Preferences
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
