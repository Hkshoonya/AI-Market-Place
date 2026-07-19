"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWalletTopUpPackForAmount } from "@/lib/constants/wallet";
import { cn } from "@/lib/utils";

interface WalletCardTopUpButtonProps {
  amount: number | null | undefined;
  returnPath: string;
  className?: string;
  label?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
  onCheckoutStarted?: () => void;
}

export function isStripeCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

export async function requestWalletCardCheckout(input: {
  pack: "starter" | "builder" | "growth" | "scale";
  returnPath: string;
}) {
  const response = await fetch("/api/marketplace/wallet/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pack: input.pack,
      return_path: input.returnPath,
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; url?: string }
    | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Unable to start card checkout");
  }
  if (!isStripeCheckoutUrl(payload.url)) {
    throw new Error("Checkout returned an invalid payment URL");
  }

  return payload.url;
}

export function WalletCardTopUpButton({
  amount,
  returnPath,
  className,
  label,
  size = "default",
  variant = "default",
  disabled = false,
  onCheckoutStarted,
}: WalletCardTopUpButtonProps) {
  const pack = getWalletTopUpPackForAmount(amount ?? 20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async () => {
    if (!pack || loading) return;

    setLoading(true);
    setError(null);

    try {
      const checkoutUrl = await requestWalletCardCheckout({
        pack: pack.slug,
        returnPath,
      });

      onCheckoutStarted?.();
      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start card checkout"
      );
      setLoading(false);
    }
  };

  if (!pack) {
    return (
      <p className="text-xs text-red-400" role="alert">
        No wallet top-up pack is available for this amount.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("w-full", className)}
        disabled={disabled || loading}
        onClick={startCheckout}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting secure checkout...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {label ?? `Add $${pack.amount} by card`}
          </>
        )}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
