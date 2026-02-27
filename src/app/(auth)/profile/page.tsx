"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<{ id: string; slug: string; name: string; provider: string }[]>([]);

  const supabase = createClient();

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
      fetchBookmarks();
    }
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
    } else {
      setMessage("Profile updated!");
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <User className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">Your Profile</h1>
      </div>

      <div className="space-y-6">
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
              <p className={`text-sm ${message.startsWith("Error") ? "text-loss" : "text-gain"}`}>
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
      </div>
    </div>
  );
}
