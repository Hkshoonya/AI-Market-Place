"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./workspace-provider";

interface WorkspaceStartButtonProps {
  label: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  model?: string | null;
  modelSlug?: string | null;
  provider?: string | null;
  action?: string | null;
  autoStartDeployment?: boolean | null;
  nextUrl?: string | null;
  sponsored?: boolean | null;
  suggestedPackSlug?: string | null;
  suggestedPack?: string | null;
  suggestedAmount?: number | null;
}

export function WorkspaceStartButton({
  label,
  className,
  size = "sm",
  ...input
}: WorkspaceStartButtonProps) {
  const { openWorkspace } = useWorkspace();

  return (
    <Button
      size={size}
      className={className}
      onClick={() => {
        openWorkspace(input);
      }}
    >
      <Globe className="h-4 w-4" />
      {label}
    </Button>
  );
}
