"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import type { User } from "@supabase/supabase-js";

const AUTH_INIT_TIMEOUT_MS = 4000;
const AUTH_CACHE_KEY = "ai-market-cap.auth";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  is_seller: boolean;
  seller_verified: boolean;
  joined_at: string | null;
  seller_bio?: string | null;
  seller_website?: string | null;
  seller_rating?: number | null;
  total_sales?: number;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Module-level singleton — safe for browser client (same instance across renders)
const supabase = createClient();

function readCachedAuthState(): { user: User | null; profile: Profile | null } {
  if (typeof window === "undefined") {
    return { user: null, profile: null };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) {
      return { user: null, profile: null };
    }

    const parsed = JSON.parse(raw) as { user?: User | null; profile?: Profile | null };
    return {
      user: parsed.user ?? null,
      profile: parsed.profile ?? null,
    };
  } catch {
    return { user: null, profile: null };
  }
}

function writeCachedAuthState(user: User | null, profile: Profile | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(AUTH_CACHE_KEY);
    return;
  }

  window.localStorage.setItem(
    AUTH_CACHE_KEY,
    JSON.stringify({
      user,
      profile,
    })
  );
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, is_admin, is_seller, seller_verified, joined_at, seller_bio, seller_website, seller_rating, total_sales, created_at")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("Profile fetch failed:", error.message);
    return null;
  }

  return data as Profile | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [cachedAuth] = useState(() => readCachedAuthState());
  const [user, setUser] = useState<User | null>(cachedAuth.user);
  const [profile, setProfile] = useState<Profile | null>(cachedAuth.profile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    let hasResolvedInitialUser = false;
    const timeoutId = window.setTimeout(() => {
      if (!isActive) return;
      console.warn("Auth initialization timed out");
      if (!hasResolvedInitialUser) {
        setUser(null);
        setProfile(null);
        writeCachedAuthState(null, null);
        posthog.reset();
      }
      setLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    const applyUser = async (currentUser: User | null) => {
      if (!isActive) return;

      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        if (!isActive) return;
        setProfile(profileData);
        writeCachedAuthState(currentUser, profileData);
        posthog.identify(currentUser.id, { email: currentUser.email });
        hasResolvedInitialUser = true;
        return;
      }

      posthog.reset();
      setProfile(null);
      writeCachedAuthState(null, null);
      hasResolvedInitialUser = true;
    };

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let resolvedSessionUser = session?.user ?? null;

        if (!resolvedSessionUser && cachedAuth.user) {
          const {
            data: refreshData,
            error: refreshError,
          } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn("Auth session refresh failed:", refreshError);
          } else {
            resolvedSessionUser = refreshData.session?.user ?? null;
          }
        }

        if (resolvedSessionUser || !cachedAuth.user) {
          await applyUser(resolvedSessionUser);
        }

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!hasResolvedInitialUser || currentUser?.id !== resolvedSessionUser?.id) {
          await applyUser(currentUser);
        }
      } catch (err) {
        console.warn("Auth initialization failed:", err);
      } finally {
        window.clearTimeout(timeoutId);
        if (isActive) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      window.clearTimeout(timeoutId);
      await applyUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Auth sign-out failed:", error);
    } finally {
      posthog.reset();
      setUser(null);
      setProfile(null);
      setLoading(false);
      writeCachedAuthState(null, null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
