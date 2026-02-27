"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
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
          <h1 className="mt-4 text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            {sent
              ? "Check your email for a reset link"
              : "Enter your email to receive a password reset link"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss" role="alert">
              {error}
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-neon/20 bg-neon/5 px-4 py-6">
                <Mail className="h-8 w-8 text-neon" />
                <p className="text-sm text-center text-muted-foreground">
                  We&apos;ve sent a password reset link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Check your inbox and follow the link to reset your password.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Send again
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary"
                aria-label="Email address"
                autoComplete="email"
              />
              <Button
                type="submit"
                className="w-full bg-neon text-background font-semibold hover:bg-neon/90"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-neon hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
