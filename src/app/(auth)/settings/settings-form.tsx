"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Key, Settings, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountInfoCard } from "./_components/account-info-card";
import { EmailChangeCard } from "./_components/email-change-card";
import { PasswordChangeCard } from "./_components/password-change-card";
import { NotificationPrefsCard } from "./_components/notification-prefs-card";
import { DangerZoneCard } from "./_components/danger-zone-card";

export default function SettingsForm() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/settings");
    }
  }, [user, authLoading, router]);

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
        <AccountInfoCard
          email={user.email}
          provider={user.app_metadata?.provider ?? "email"}
          isAdmin={!!profile?.is_admin}
        />
        <EmailChangeCard currentEmail={user.email} />
        <PasswordChangeCard userEmail={user.email} />
        <NotificationPrefsCard />
        <Separator className="border-border/50" />
        <DangerZoneCard signOut={signOut} />
      </div>
    </div>
  );
}
