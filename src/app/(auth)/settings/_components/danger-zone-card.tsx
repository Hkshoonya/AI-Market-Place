"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface DangerZoneCardProps {
  signOut: () => Promise<void>;
}

export function DangerZoneCard({ signOut }: DangerZoneCardProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (res.ok) {
        router.push("/?deleted=true");
      } else {
        const json = await res.json();
        setDeleteError(json.error || "Failed to delete account.");
      }
    } catch {
      setDeleteError("An unexpected error occurred.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card className="border-loss/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-loss">
          <Trash2 className="h-5 w-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sign Out</p>
            <p className="text-xs text-muted-foreground">Sign out of your account on this device</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-loss/30 text-loss hover:bg-loss/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Separator className="border-border/30" />

        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            {!showDeleteConfirm && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-loss/30 text-loss hover:bg-loss/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
          {showDeleteConfirm && (
            <div className="mt-4 rounded-lg border border-loss/30 bg-loss/5 p-4 space-y-3">
              <p className="text-sm text-loss">
                This action is irreversible. Type{" "}
                <span className="font-mono font-bold">DELETE</span> to confirm.
              </p>
              <Input
                placeholder='Type "DELETE"'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="bg-secondary"
                aria-label="Type DELETE to confirm account deletion"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                  className="gap-2"
                  onClick={handleDeleteAccount}
                >
                  {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleteLoading ? "Deleting..." : "Permanently Delete"}
                </Button>
                {deleteError && <p className="text-xs text-loss mt-2">{deleteError}</p>}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
