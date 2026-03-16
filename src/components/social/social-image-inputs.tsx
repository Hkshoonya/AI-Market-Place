"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SocialImageAttachmentInput } from "@/lib/social/media";

interface SocialImageInputsProps {
  attachments: SocialImageAttachmentInput[];
  onChange: (attachments: SocialImageAttachmentInput[]) => void;
  maxItems?: number;
}

export function SocialImageInputs({
  attachments,
  onChange,
  maxItems = 4,
}: SocialImageInputsProps) {
  function updateAttachment(
    index: number,
    key: keyof SocialImageAttachmentInput,
    value: string
  ) {
    onChange(
      attachments.map((attachment, attachmentIndex) =>
        attachmentIndex === index
          ? { ...attachment, [key]: value }
          : attachment
      )
    );
  }

  function removeAttachment(index: number) {
    onChange(attachments.filter((_, attachmentIndex) => attachmentIndex !== index));
  }

  function addAttachment() {
    if (attachments.length >= maxItems) return;
    onChange([...attachments, { url: "", alt_text: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Images</div>
          <p className="text-xs text-muted-foreground">
            Add up to {maxItems} external image URLs. Images stay lightweight until native uploads are introduced.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAttachment}
          disabled={attachments.length >= maxItems}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Add image
        </Button>
      </div>

      {attachments.map((attachment, index) => (
        <div
          key={`attachment-${index}`}
          className="grid gap-3 rounded-xl border border-border/50 bg-secondary/10 p-3"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
            <Input
              placeholder="https://example.com/image.png"
              value={attachment.url}
              onChange={(event) =>
                updateAttachment(index, "url", event.target.value)
              }
              aria-label={`Image URL ${index + 1}`}
            />
            <Input
              placeholder="Alt text (optional)"
              value={attachment.alt_text ?? ""}
              onChange={(event) =>
                updateAttachment(index, "alt_text", event.target.value)
              }
              aria-label={`Image alt text ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAttachment(index)}
              aria-label={`Remove image ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
