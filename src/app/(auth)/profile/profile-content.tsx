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
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/format";
import { toast } from "sonner";

const supabase = createClient();

export default function ProfileContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<
    { id: string; slug: string; name: string; provider: string }[]
  >([]);
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/profile");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      // Fetch user bookmarks
      const fetchBookmarks = async () => {
        const { data } = await supabase
          .from("user_bookmarks")
          .select("id, model_id, models(slug, name, provider)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (data) {
          setBookmarks(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.map((b: any) => ({
              id: b.id,
              slug: b.models?.slug ?? "",
              name: b.models?.name ?? "Unknown",
              provider: b.models?.provider ?? "",
            }))
          );
        }
      };

      // Fetch watchlist count
      const fetchWatchlistCount = async () => {
        const { count } = await supabase
          .from("watchlists")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        setWatchlistCount(count ?? 0);
      };

      fetchBookmarks();
      fetchWatchlistCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        display_name: displayName || null,
        username: username || null,
        bio: bio || null,
      })
      .eq("id", user.id);

    if (error) {
      setMessage(`Error: ${error.message}`);
      toast.error("Failed to update profile");
    } else {
      setMessage("Profile updated!");
      toast.success("Profile updated successfully");
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Profile header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neon/10 text-neon text-2xl font-bold">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt="Avatar"
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
              <label className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <Input
                value={user.email ?? ""}
                disabled
                className="mt-1 bg-secondary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Display Name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="mt-1 bg-secondary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="unique_username"
                className="mt-1 bg-secondary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
              />
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
                    <Link href="/sell">Create New Listing</Link>
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
                  <Link href="/sell">Start Selling</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
