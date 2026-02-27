"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreateWatchlistDialogProps {
  onCreated?: (watchlist: { id: string; name: string }) => void;
  trigger?: React.ReactNode;
}

export function CreateWatchlistDialog({
  onCreated,
  trigger,
}: CreateWatchlistDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create watchlist");
        return;
      }

      setName("");
      setDescription("");
      setIsPublic(false);
      setOpen(false);
      onCreated?.(json.data);
    } catch {
      setError("Failed to create watchlist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            className="gap-2 bg-neon text-background font-semibold hover:bg-neon/90"
          >
            <Plus className="h-4 w-4" />
            New Watchlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Watchlist</DialogTitle>
          <DialogDescription>
            Organize AI models into custom watchlists to track their progress.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="watchlist-name" className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <Input
              id="watchlist-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Top LLMs, Image Models..."
              className="mt-1 bg-secondary"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label htmlFor="watchlist-description" className="text-sm font-medium text-muted-foreground">
              Description (optional)
            </label>
            <textarea
              id="watchlist-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What models will you track here?"
              rows={2}
              className="mt-1 w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-border accent-neon"
            />
            <span className="text-muted-foreground">
              Make this watchlist public
            </span>
          </label>

          {error && <p className="text-sm text-loss" role="alert">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="bg-neon text-background font-semibold hover:bg-neon/90"
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
