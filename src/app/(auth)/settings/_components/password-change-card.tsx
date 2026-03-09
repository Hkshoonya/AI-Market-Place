"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export interface PasswordChangeCardProps {
  userEmail: string | undefined;
}

export function PasswordChangeCard({ userEmail }: PasswordChangeCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState(false);

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
    if (!currentPassword) {
      setPasswordMessage("Current password is required.");
      setPasswordError(true);
      return;
    }
    if (!userEmail) {
      setPasswordMessage("Unable to verify identity. Please sign in again.");
      setPasswordError(true);
      return;
    }

    setPasswordLoading(true);
    const supabase = createClient();

    // Verify current password first
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (verifyError) {
      setPasswordMessage("Current password is incorrect.");
      setPasswordError(true);
      setPasswordLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

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

  return (
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
            <label className="text-sm font-medium text-muted-foreground">Current Password</label>
            <Input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1 bg-secondary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">New Password</label>
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
            <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
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
            <p className={`text-sm ${passwordError ? "text-loss" : "text-gain"}`}>{passwordMessage}</p>
          )}
          <Button type="submit" disabled={passwordLoading} variant="outline" size="sm" className="gap-2">
            <Lock className="h-4 w-4" />
            {passwordLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
