"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Github, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export interface LoginFormProps {
  initialRedirect?: string;
  hasAuthError?: boolean;
}

function sanitizeRedirect(rawRedirect?: string) {
  if (
    rawRedirect &&
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.includes(":")
  ) {
    return rawRedirect;
  }

  return "/";
}

export default function LoginForm({
  initialRedirect,
  hasAuthError = false,
}: LoginFormProps) {
  const redirectTo = sanitizeRedirect(initialRedirect);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    hasAuthError ? "Authentication failed. Please try again." : null
  );
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const waitForBrowserSession = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        return true;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

    return false;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const hasSettledSession = Boolean(data.session?.user) || (await waitForBrowserSession());

      if (!hasSettledSession) {
        setError("Signed in, but the session did not finish syncing. Please try again.");
        setLoading(false);
        return;
      }

      window.location.assign(redirectTo);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/50 bg-card">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
              <Activity className="h-6 w-6 text-neon" />
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your AI Market Cap account
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss" role="alert">
              {error}
            </div>
          )}

          {/* OAuth buttons */}
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthLogin("github")}
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthLogin("google")}
            >
              <Mail className="h-4 w-4" />
              Continue with Google
            </Button>
          </div>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>

          {/* Email login */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <Input
              id="login-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary"
              aria-label="Email address"
              autoComplete="email"
            />
            <Input
              id="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-secondary"
              aria-label="Password"
              autoComplete="current-password"
            />
            <Button
              type="submit"
              className="w-full bg-neon text-background font-semibold hover:bg-neon/90"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-neon transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-neon hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
