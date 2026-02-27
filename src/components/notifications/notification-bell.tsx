"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { ActivityFeed } from "./activity-feed";

export function NotificationBell() {
  const { user } = useAuth();
  const [hasActivity, setHasActivity] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Quick check if user has any watchlist items (to show dot indicator)
    const checkActivity = async () => {
      try {
        const res = await fetch("/api/activity");
        const json = await res.json();
        if (res.ok && json.data && json.data.length > 0 && !json.isGlobal) {
          setHasActivity(true);
        }
      } catch {
        // ignore
      }
    };
    checkActivity();
  }, [user]);

  if (!user) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {hasActivity && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-neon" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card sm:max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-neon" />
            Activity
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <ActivityFeed maxItems={15} compact />
        </div>
        <div className="border-t border-border/30 pt-3 flex justify-center">
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/activity">View All Activity</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
