"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Github, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/50 bg-card">
          <CardContent className="p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-gain" />
            <h2 className="mt-4 text-xl font-bold">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>. Click it to
              activate your account.
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/login">Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/50 bg-card">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
              <Activity className="h-6 w-6 text-neon" />
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Join AI Market Cap to track, compare, and discuss AI models
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss" role="alert">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthSignup("github")}
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthSignup("google")}
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

          <form onSubmit={handleSignup} className="space-y-3">
            <Input
              id="signup-email"
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
              id="signup-password"
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-secondary"
              aria-label="Password, minimum 6 characters"
              autoComplete="new-password"
            />
            <Input
              id="signup-confirm-password"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-secondary"
              aria-label="Confirm password"
              autoComplete="new-password"
            />
            <Button
              type="submit"
              className="w-full bg-neon text-background font-semibold hover:bg-neon/90"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-neon hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
