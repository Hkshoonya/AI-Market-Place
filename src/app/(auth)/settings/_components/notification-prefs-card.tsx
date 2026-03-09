"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Mail, Save, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface NotifPrefs {
  email_model_updates: boolean;
  email_watchlist_changes: boolean;
  email_order_updates: boolean;
  email_marketplace: boolean;
  email_newsletter: boolean;
  in_app_model_updates: boolean;
  in_app_watchlist_changes: boolean;
  in_app_order_updates: boolean;
  in_app_marketplace: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  email_model_updates: true,
  email_watchlist_changes: true,
  email_order_updates: true,
  email_marketplace: false,
  email_newsletter: true,
  in_app_model_updates: true,
  in_app_watchlist_changes: true,
  in_app_order_updates: true,
  in_app_marketplace: true,
};

const EMAIL_OPTIONS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: "email_model_updates", label: "Model updates", desc: "When models you follow get updated" },
  { key: "email_watchlist_changes", label: "Watchlist changes", desc: "Significant changes to watchlisted models" },
  { key: "email_order_updates", label: "Order updates", desc: "When your marketplace orders change status" },
  { key: "email_marketplace", label: "Marketplace", desc: "New listings and marketplace activity" },
  { key: "email_newsletter", label: "Newsletter", desc: "Weekly AI market digest and insights" },
];

const IN_APP_OPTIONS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: "in_app_model_updates", label: "Model updates", desc: "Real-time model update alerts" },
  { key: "in_app_watchlist_changes", label: "Watchlist changes", desc: "Alerts for watchlisted model changes" },
  { key: "in_app_order_updates", label: "Order updates", desc: "Marketplace order status changes" },
  { key: "in_app_marketplace", label: "Marketplace", desc: "New listings and marketplace activity" },
];

function ToggleSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-neon" : "bg-secondary"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function NotificationPrefsCard() {
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  const fetchNotifPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences");
      const json = await res.json();
      if (res.ok && json.data) {
        setNotifPrefs((prev) => ({ ...prev, ...json.data }));
      }
    } catch {
      // use defaults
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifPrefs();
  }, [fetchNotifPrefs]);

  const toggleNotifPref = (key: keyof NotifPrefs) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setNotifMessage(null);
  };

  const saveNotifPrefs = async () => {
    setNotifSaving(true);
    setNotifMessage(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifPrefs),
      });
      setNotifMessage(res.ok ? "Preferences saved!" : "Failed to save preferences.");
    } catch {
      setNotifMessage("Failed to save preferences.");
    } finally {
      setNotifSaving(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-neon" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {notifLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Email notifications */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Email Notifications</h4>
              </div>
              <div className="space-y-3">
                {EMAIL_OPTIONS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <ToggleSwitch
                      checked={notifPrefs[item.key]}
                      label={item.label}
                      onChange={() => toggleNotifPref(item.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator className="border-border/30" />

            {/* In-app notifications */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">In-App Notifications</h4>
              </div>
              <div className="space-y-3">
                {IN_APP_OPTIONS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <ToggleSwitch
                      checked={notifPrefs[item.key]}
                      label={item.label}
                      onChange={() => toggleNotifPref(item.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {notifMessage && (
              <p className={`text-sm ${notifMessage.includes("saved") ? "text-gain" : "text-loss"}`}>
                {notifMessage}
              </p>
            )}

            <Button onClick={saveNotifPrefs} disabled={notifSaving} variant="outline" size="sm" className="gap-2">
              {notifSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {notifSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
