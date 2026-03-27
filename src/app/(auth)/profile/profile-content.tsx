"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Eye,
  Globe,
  Heart,
  LayoutDashboard,
  Save,
  Settings,
  Shield,
  ShoppingBag,
} from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { SWR_TIERS } from "@/lib/swr/config";
import { parseQueryResult } from "@/lib/schemas/parse";
import { BookmarkWithModelSchema } from "@/lib/schemas/community";
import { formatRelativeDate } from "@/lib/format";
import { toast } from "sonner";

interface ProfileData {
  bookmarks: { id: string; slug: string; name: string; provider: string }[];
  watchlistCount: number;
}

function buildAvatarSeed(...parts: Array<string | null | undefined>) {
  const seed = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("-");

  return seed.length > 0 ? seed : "aimarketcap-user";
}

function buildAvatarOptions(seed: string) {
  return [
    {
      id: "bottts",
      label: "Bottts",
      url: `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`,
    },
    {
      id: "identicon",
      label: "Identicon",
      url: `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}`,
    },
    {
      id: "shapes",
      label: "Shapes",
      url: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}`,
    },
    {
      id: "initials",
      label: "Initials",
      url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`,
    },
  ];
}

export default function ProfileContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState<string | null>(null);
  const [customAvatarUrlDraft, setCustomAvatarUrlDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: profileData } = useSWR<ProfileData>(
    user ? 'supabase:user-profile' : null,
    async () => {
      const supabase = createClient();

      // Fetch user bookmarks
      const response = await supabase
        .from("user_bookmarks")
        .select("id, model_id, models(slug, name, provider)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      const bookmarkData = parseQueryResult(response, BookmarkWithModelSchema, "BookmarkWithModel");
      const bookmarks = (bookmarkData ?? []).map((b) => ({
        id: b.id,
        slug: b.models?.slug ?? "",
        name: b.models?.name ?? "Unknown",
        provider: b.models?.provider ?? "",
      }));

      // Fetch watchlist count
      const { count } = await supabase
        .from("watchlists")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);

      return {
        bookmarks,
        watchlistCount: count ?? 0,
      };
    },
    { ...SWR_TIERS.SLOW }
  );

  const bookmarks = profileData?.bookmarks ?? [];
  const watchlistCount = profileData?.watchlistCount ?? 0;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/profile");
    }
  }, [user, authLoading, router]);

  const displayName = displayNameDraft ?? profile?.display_name ?? "";
  const username = usernameDraft ?? profile?.username ?? "";
  const bio = bioDraft ?? profile?.bio ?? "";
  const avatarUrl = avatarUrlDraft ?? profile?.avatar_url ?? "";
  const customAvatarUrl = customAvatarUrlDraft ?? profile?.avatar_url ?? "";

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        username: username || null,
        bio: bio || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      setMessage(`Error: ${error.message}`);
      toast.error("Failed to update profile");
    } else {
      setMessage("Profile updated!");
      toast.success("Profile updated successfully");
      setDisplayNameDraft(null);
      setUsernameDraft(null);
      setBioDraft(null);
      setAvatarUrlDraft(null);
      setCustomAvatarUrlDraft(null);
    }
    setSaving(false);
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

  const initials = (
    profile?.display_name || profile?.username || user.email || "?"
  )
    .charAt(0)
    .toUpperCase();
  const avatarSeed = buildAvatarSeed(displayName, username, user.email);
  const avatarOptions = buildAvatarOptions(avatarSeed);
  const previewAvatarUrl = avatarUrl.trim() || null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Profile header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neon/10 text-neon text-2xl font-bold">
          {previewAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewAvatarUrl}
              alt={`${profile.display_name || "User"} profile picture`}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">
              {profile?.display_name || profile?.username || "Your Profile"}
            </h1>
            {profile?.is_admin && (
              <Badge
                variant="outline"
                className="border-neon/30 text-neon text-[11px]"
              >
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Badge>
            )}
            {profile?.seller_verified && (
              <Badge
                variant="outline"
                className="border-gain/30 text-gain text-[11px]"
              >
                Verified Seller
              </Badge>
            )}
          </div>
          {profile?.username && (
            <p className="text-sm text-muted-foreground">
              @{profile.username}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Joined{" "}
              {profile?.joined_at
                ? formatRelativeDate(profile.joined_at)
                : "recently"}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {bookmarks.length} bookmarks
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {watchlistCount} watchlists
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          asChild
        >
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        {/* Admin link */}
        {profile?.is_admin && (
          <Card className="border-neon/20 bg-neon/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-5 w-5 text-neon" />
                <div>
                  <p className="text-sm font-semibold">Admin Dashboard</p>
                  <p className="text-xs text-muted-foreground">
                    Manage models, users, and marketplace
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-neon/30 text-neon"
                asChild
              >
                <Link href="/admin">Open Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Profile form */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="profile-email" className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <Input
                id="profile-email"
                value={user.email ?? ""}
                disabled
                className="mt-1 bg-secondary/50"
              />
            </div>
            <div>
              <label htmlFor="profile-display-name" className="text-sm font-medium text-muted-foreground">
                Display Name
              </label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                placeholder="Your name"
                className="mt-1 bg-secondary"
              />
            </div>
            <div>
              <label htmlFor="profile-username" className="text-sm font-medium text-muted-foreground">
                Username
              </label>
              <Input
                id="profile-username"
                value={username}
                onChange={(e) => setUsernameDraft(e.target.value)}
                placeholder="unique_username"
                className="mt-1 bg-secondary"
              />
            </div>
            <div>
              <label htmlFor="profile-bio" className="text-sm font-medium text-muted-foreground">
                Bio
              </label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBioDraft(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Profile Picture
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a ready-made avatar or paste any image URL you want to use.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {avatarOptions.map((option) => {
                  const isSelected = avatarUrl.trim() === option.url;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setAvatarUrlDraft(option.url);
                        setCustomAvatarUrlDraft(option.url);
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-neon bg-neon/10"
                          : "border-border/50 bg-secondary/30 hover:border-neon/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={option.url}
                          alt={`${option.label} avatar option`}
                          className="h-12 w-12 rounded-full border border-border/50 bg-background object-cover"
                        />
                        <div>
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Ready to use
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div>
                <label htmlFor="profile-avatar-url" className="text-sm font-medium text-muted-foreground">
                  Custom Avatar URL
                </label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="profile-avatar-url"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrlDraft(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="bg-secondary"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAvatarUrlDraft(customAvatarUrl.trim())}
                    >
                      Use URL
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAvatarUrlDraft("");
                        setCustomAvatarUrlDraft("");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {message && (
              <p
                className={`text-sm ${message.startsWith("Error") ? "text-loss" : "text-gain"}`}
              >
                {message}
              </p>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-neon text-background font-semibold hover:bg-neon/90"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-neon/20 bg-neon/5">
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete the core setup once so your account is ready for marketplace purchases,
              API access, and seller payouts.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/wallet">1. Create Wallet</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/api-keys">2. Create API Keys</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/marketplace">3. Fund and Purchase</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/sell" prefetch={false}>4. Enable Seller Flow</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Wallet deposits and withdrawals use USDC. API keys are one-time reveal only, so
              copy them when you create them. On-chain deposits are detected automatically on a
              short cron cadence, so new wallet funding may take a few minutes to appear.
            </p>
          </CardContent>
        </Card>

        {/* Watchlists */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-neon" />
              Watchlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Organize AI models into custom watchlists and get personalized
              activity updates.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/watchlists">View Watchlists</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/activity">Activity Feed</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/discover">
                  <Globe className="mr-1 h-3 w-3" />
                  Discover Public
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bookmarks */}
        <Card className="border-border/50 bg-card" id="bookmarks">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-neon" />
              Your Bookmarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookmarks.length > 0 ? (
              <div className="space-y-2">
                {bookmarks.map((b) => (
                  <Link
                    key={b.id}
                    href={`/models/${b.slug}`}
                    className="flex items-center justify-between rounded-lg border border-border/30 px-4 py-3 transition-colors hover:bg-secondary/20"
                  >
                    <div>
                      <span className="text-sm font-medium hover:text-neon">
                        {b.name}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {b.provider}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No bookmarks yet. Browse{" "}
                <Link href="/models" className="text-neon hover:underline">
                  models
                </Link>{" "}
                and bookmark your favorites!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Seller Section */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="h-5 w-5 text-neon" />
              Seller
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile?.is_seller ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You are a registered seller on AI Market Cap.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/seller">Seller Dashboard</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/sell" prefetch={false}>Create New Listing</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Start selling your AI models, APIs, and datasets on the
                  marketplace.
                </p>
                <Button
                  className="bg-neon text-background font-semibold hover:bg-neon/90"
                  asChild
                >
                  <Link href="/sell" prefetch={false}>Start Selling</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
