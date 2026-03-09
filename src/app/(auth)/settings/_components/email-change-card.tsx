"use client";

import { useState } from "react";
import { Key, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export interface EmailChangeCardProps {
  currentEmail: string | undefined;
}

export function EmailChangeCard({ currentEmail }: EmailChangeCardProps) {
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMessage(null);
    setEmailError(false);

    if (!newEmail || newEmail === currentEmail) {
      setEmailMessage("Please enter a different email address.");
      setEmailError(true);
      return;
    }

    setEmailLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      setEmailMessage(error.message);
      setEmailError(true);
    } else {
      setEmailMessage("Confirmation email sent to your new address. Check both inboxes.");
      setEmailError(false);
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  return (
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
            <label className="text-sm font-medium text-muted-foreground">New Email Address</label>
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
            <p className={`text-sm ${emailError ? "text-loss" : "text-gain"}`}>{emailMessage}</p>
          )}
          <Button type="submit" disabled={emailLoading} variant="outline" size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            {emailLoading ? "Updating..." : "Update Email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
