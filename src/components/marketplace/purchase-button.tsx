"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Loader2,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { formatCurrency } from "@/lib/format";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { GuestCheckoutForm } from "./guest-checkout-form";
import { WalletDepositPanel } from "./wallet-deposit-panel";
import { PurchaseSuccess } from "./purchase-success";

interface PurchaseButtonProps {
  listingId: string;
  price: number | null;
  pricingType: string;
  currency?: string;
  sellerName?: string;
}

interface DeliveryData {
  api_key?: string;
  download_url?: string;
  access_url?: string;
  instructions?: string;
  [key: string]: unknown;
}

export function PurchaseButton({
  listingId,
  price,
  pricingType,
  currency = "USD",
  sellerName,
}: PurchaseButtonProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Guest checkout fields
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");

  const isFree = pricingType === "free" || (price != null && price === 0);
  const isGuest = !user;

  const { walletData, loadingWallet } = useWalletBalance({
    enabled: open && !!user && !isFree,
  });

  const handleOpenChange = (value: boolean) => {
    if (!value && purchasing) return;
    setOpen(value);
    if (!value) {
      setError("");
      setDelivery(null);
      setGuestEmail("");
      setGuestName("");
    }
  };

  const handlePurchase = async () => {
    if (isGuest && isFree) {
      if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    setPurchasing(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        listing_id: listingId,
        payment_method: "balance",
      };

      if (isGuest && isFree) {
        body.guest_email = guestEmail.trim();
        if (guestName.trim()) body.guest_name = guestName.trim();
      }

      const res = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 402) {
        setError("Insufficient balance. Please deposit funds to your wallet.");
        setPurchasing(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Purchase failed");
      }

      const data = await res.json();
      setDelivery(data.delivery ?? data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPurchasing(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignored
    }
  }, []);

  const insufficientBalance =
    walletData != null && price != null && walletData.balance < price;

  if (pricingType === "contact") return null;

  const buttonLabel = isFree
    ? "Get Free"
    : `Buy Now \u2014 ${price != null ? formatCurrency(price, currency) : ""}`;

  const dialogTitle = delivery
    ? isFree ? "Access Granted!" : "Purchase Complete!"
    : isGuest && isFree
      ? "Get Free Access"
      : isGuest && !isFree
        ? "Sign in to Purchase"
        : isFree
          ? "Confirm Free Access"
        : "Confirm Purchase";
  const redirectPath = pathname || "/marketplace";
  const loginHref = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(redirectPath)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-neon text-background hover:bg-neon/90 gap-2">
          {!isFree && <ShoppingCart className="h-4 w-4 shrink-0" />}
          <span className="truncate">{buttonLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="bg-card border-border/50 sm:max-w-md max-h-[85vh] overflow-y-auto"
        showCloseButton={!purchasing}
      >
        {/* ───── Success state ───── */}
        {delivery ? (
          <PurchaseSuccess
            delivery={delivery}
            isFree={isFree}
            dialogTitle={dialogTitle}
            copiedField={copiedField}
            onCopy={copyToClipboard}
            onClose={() => handleOpenChange(false)}
            showOrders={!!user}
          />
        ) : isGuest && isFree ? (
          /* ───── Guest checkout for free items ───── */
          <GuestCheckoutForm
            sellerName={sellerName}
            guestEmail={guestEmail}
            setGuestEmail={setGuestEmail}
            guestName={guestName}
            setGuestName={setGuestName}
            error={error}
            purchasing={purchasing}
            onPurchase={handlePurchase}
            onCancel={() => handleOpenChange(false)}
          />
        ) : isGuest && !isFree ? (
          /* ───── Guest on paid item — needs account for wallet ───── */
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10 shrink-0">
                  <Wallet className="h-5 w-5 text-neon" />
                </div>
                <div>
                  <DialogTitle>Sign in to Purchase</DialogTitle>
                  <DialogDescription>Account required for paid items</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Item Price</span>
                <span className="font-semibold text-neon">
                  {price != null ? formatCurrency(price, currency) : "N/A"}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Paid purchases use your wallet balance. Sign in or create a free account to continue.
            </p>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button asChild className="flex-1 bg-neon text-background hover:bg-neon/90">
                <Link href={loginHref}>Sign In</Link>
              </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href={signupHref} className="text-neon hover:underline">
                Sign up free
              </Link>
            </p>
          </>
        ) : user && isFree ? (
          /* ───── Logged-in user on free item ───── */
          <>
            <DialogHeader>
              <DialogTitle>Confirm Free Access</DialogTitle>
              {sellerName && (
                <DialogDescription>From {sellerName}</DialogDescription>
              )}
            </DialogHeader>

            <div className="rounded-lg border border-neon/20 bg-neon/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold text-neon">Free</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={purchasing}>
                Cancel
              </Button>
              <Button className="flex-1 bg-neon text-background hover:bg-neon/90" disabled={purchasing} onClick={handlePurchase}>
                {purchasing ? <><Loader2 className="h-4 w-4 animate-spin" />Processing...</> : "Get Access"}
              </Button>
            </div>
          </>
        ) : (
          /* ───── Logged-in user on paid item — wallet confirmation ───── */
          <>
            <DialogHeader>
              <DialogTitle>Confirm Purchase</DialogTitle>
              {sellerName && (
                <DialogDescription>From {sellerName}</DialogDescription>
              )}
            </DialogHeader>

            <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Item Price</span>
                <span className="font-semibold text-foreground">
                  {price != null ? formatCurrency(price, currency) : "Free"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wallet Balance</span>
                {loadingWallet ? (
                  <span className="inline-block h-5 w-16 animate-pulse rounded bg-secondary" />
                ) : (
                  <span className={`font-semibold ${insufficientBalance ? "text-red-400" : "text-emerald-400"}`}>
                    {formatCurrency(walletData?.balance ?? 0)}
                  </span>
                )}
              </div>
              {insufficientBalance && price != null && (
                <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">Amount Needed</span>
                  <span className="font-semibold text-red-400">
                    {formatCurrency(price - (walletData?.balance ?? 0))}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {insufficientBalance && (
              <WalletDepositPanel walletData={walletData} price={price} copiedField={copiedField} onCopy={copyToClipboard} />
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={purchasing}>
                Cancel
              </Button>
              <Button className="flex-1 bg-neon text-background hover:bg-neon/90" disabled={purchasing || loadingWallet || insufficientBalance} onClick={handlePurchase}>
                {purchasing ? <><Loader2 className="h-4 w-4 animate-spin" />Processing...</> : "Confirm Purchase"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
