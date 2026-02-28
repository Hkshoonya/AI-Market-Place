"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Key,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Save,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

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

export default function SettingsForm() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    email_model_updates: true,
    email_watchlist_changes: true,
    email_order_updates: true,
    email_marketplace: false,
    email_newsletter: true,
    in_app_model_updates: true,
    in_app_watchlist_changes: true,
    in_app_order_updates: true,
    in_app_marketplace: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  const supabase = createClient();

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
    if (!authLoading && !user) {
      router.push("/login?redirect=/settings");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchNotifPrefs();
    }
  }, [user, fetchNotifPrefs]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(false);

    if (newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters.");
      setPasswordError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      setPasswordError(true);
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordMessage(error.message);
      setPasswordError(true);
    } else {
      setPasswordMessage("Password updated successfully!");
      setPasswordError(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMessage(null);
    setEmailError(false);

    if (!newEmail || newEmail === user?.email) {
      setEmailMessage("Please enter a different email address.");
      setEmailError(true);
      return;
    }

    setEmailLoading(true);

    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      setEmailMessage(error.message);
      setEmailError(true);
    } else {
      setEmailMessage(
        "Confirmation email sent to your new address. Check both inboxes."
      );
      setEmailError(false);
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (res.ok) {
        router.push("/?deleted=true");
      } else {
        const json = await res.json();
        setDeleteError(json.error || "Failed to delete account.");
      }
    } catch {
      setDeleteError("An unexpected error occurred.");
    } finally {
      setDeleteLoading(false);
    }
  };

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
      if (res.ok) {
        setNotifMessage("Preferences saved!");
      } else {
        setNotifMessage("Failed to save preferences.");
      }
    } catch {
      setNotifMessage("Failed to save preferences.");
    } finally {
      setNotifSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/profile"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Profile
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
          <Settings className="h-5 w-5 text-neon" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account security and preferences
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link
          href="/settings/api-keys"
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors"
        >
          <Key className="h-4 w-4 text-neon" />
          API Keys
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors"
        >
          <User className="h-4 w-4 text-neon" />
          Edit Profile
        </Link>
      </div>

      <div className="space-y-6">
        {/* Account info */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-neon" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Email Address
              </label>
              <p className="mt-1 text-sm">{user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Auth Provider
              </label>
              <p className="mt-1 text-sm capitalize">
                {user.app_metadata?.provider ?? "email"}
              </p>
            </div>
            {profile?.is_admin && (
              <div className="flex items-center gap-2 rounded-lg border border-neon/20 bg-neon/5 px-3 py-2">
                <Shield className="h-4 w-4 text-neon" />
                <span className="text-sm font-medium text-neon">
                  Admin Account
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change email */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-neon" />
              Change Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  New Email Address
                </label>
                <Input
                  type="email"
                  placeholder="new@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="mt-1 bg-secondary"
                />
              </div>
              {emailMessage && (
                <p
                  className={`text-sm ${emailError ? "text-loss" : "text-gain"}`}
                >
                  {emailMessage}
                </p>
              )}
              <Button
                type="submit"
                disabled={emailLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {emailLoading ? "Updating..." : "Update Email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5 text-neon" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  New Password
                </label>
                <Input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 bg-secondary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1 bg-secondary"
                />
              </div>
              {passwordMessage && (
                <p
                  className={`text-sm ${passwordError ? "text-loss" : "text-gain"}`}
                >
                  {passwordMessage}
                </p>
              )}
              <Button
                type="submit"
                disabled={passwordLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                {passwordLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification preferences */}
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
                    {([
                      { key: "email_model_updates" as const, label: "Model updates", desc: "When models you follow get updated" },
                      { key: "email_watchlist_changes" as const, label: "Watchlist changes", desc: "Significant changes to watchlisted models" },
                      { key: "email_order_updates" as const, label: "Order updates", desc: "When your marketplace orders change status" },
                      { key: "email_marketplace" as const, label: "Marketplace", desc: "New listings and marketplace activity" },
                      { key: "email_newsletter" as const, label: "Newsletter", desc: "Weekly AI market digest and insights" },
                    ]).map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={notifPrefs[item.key]}
                          aria-label={item.label}
                          onClick={() => toggleNotifPref(item.key)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            notifPrefs[item.key] ? "bg-neon" : "bg-secondary"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${
                              notifPrefs[item.key] ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
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
                    {([
                      { key: "in_app_model_updates" as const, label: "Model updates", desc: "Real-time model update alerts" },
                      { key: "in_app_watchlist_changes" as const, label: "Watchlist changes", desc: "Alerts for watchlisted model changes" },
                      { key: "in_app_order_updates" as const, label: "Order updates", desc: "Marketplace order status changes" },
                      { key: "in_app_marketplace" as const, label: "Marketplace", desc: "New listings and marketplace activity" },
                    ]).map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={notifPrefs[item.key]}
                          aria-label={item.label}
                          onClick={() => toggleNotifPref(item.key)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            notifPrefs[item.key] ? "bg-neon" : "bg-secondary"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${
                              notifPrefs[item.key] ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {notifMessage && (
                  <p className={`text-sm ${notifMessage.includes("saved") ? "text-gain" : "text-loss"}`}>
                    {notifMessage}
                  </p>
                )}

                <Button
                  onClick={saveNotifPrefs}
                  disabled={notifSaving}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {notifSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {notifSaving ? "Saving..." : "Save Preferences"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Separator className="border-border/50" />

        {/* Danger zone */}
        <Card className="border-loss/20 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-loss">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sign Out</p>
                <p className="text-xs text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-loss/30 text-loss hover:bg-loss/10"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>

            <Separator className="border-border/30" />

            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                {!showDeleteConfirm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-loss/30 text-loss hover:bg-loss/10"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
              {showDeleteConfirm && (
                <div className="mt-4 rounded-lg border border-loss/30 bg-loss/5 p-4 space-y-3">
                  <p className="text-sm text-loss">
                    This action is irreversible. Type{" "}
                    <span className="font-mono font-bold">DELETE</span> to
                    confirm.
                  </p>
                  <Input
                    placeholder='Type "DELETE"'
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="bg-secondary"
                    aria-label="Type DELETE to confirm account deletion"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                      className="gap-2"
                      onClick={handleDeleteAccount}
                    >
                      {deleteLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {deleteLoading ? "Deleting..." : "Permanently Delete"}
                    </Button>
                    {deleteError && (
                      <p className="text-xs text-loss mt-2">{deleteError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
