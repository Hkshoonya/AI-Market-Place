"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getProviderBrand } from "@/lib/constants/providers";

interface ProviderLogoProps {
  provider: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { container: "h-5 w-5", text: "text-[10px]", nameText: "text-xs" },
  md: { container: "h-7 w-7", text: "text-xs", nameText: "text-sm" },
  lg: { container: "h-9 w-9", text: "text-sm", nameText: "text-base" },
};

export function ProviderLogo({
  provider,
  size = "sm",
  showName = false,
  className,
}: ProviderLogoProps) {
  const [imgError, setImgError] = useState(false);
  const brand = getProviderBrand(provider);
  const sizeConfig = SIZE_MAP[size];

  const domain = brand?.domain;
  const brandColor = brand?.color ?? "#666666";
  const initial = provider.charAt(0).toUpperCase();

  // Use Clearbit logo API
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={`${provider} logo`}
          className={cn(sizeConfig.container, "rounded-sm object-contain")}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <span
          className={cn(
            sizeConfig.container,
            "inline-flex items-center justify-center rounded-sm font-bold",
            sizeConfig.text
          )}
          style={{
            backgroundColor: `${brandColor}20`,
            color: brandColor,
          }}
        >
          {initial}
        </span>
      )}
      {showName && (
        <span className={cn(sizeConfig.nameText, "text-muted-foreground")}>
          {provider}
        </span>
      )}
    </span>
  );
}
