"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Wallet,
  ExternalLink,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { formatCurrency } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PurchaseButtonProps {
  listingId: string;
  price: number | null;
  pricingType: string;
  currency?: string;
  sellerName?: string;
}

interface WalletBalance {
  balance: number;
  solana_deposit_address: string | null;
  evm_deposit_address: string | null;
}

interface DeliveryData {
  api_key?: string;
  download_url?: string;
  access_url?: string;
  instructions?: string;
  [key: string]: any;
}

export function PurchaseButton({
  listingId,
  price,
  pricingType,
  currency = "USD",
  sellerName,
}: PurchaseButtonProps) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [walletData, setWalletData] = useState<WalletBalance | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Guest checkout fields
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");

  const isFree = pricingType === "free" || (price != null && price === 0);
  const isGuest = !user;

  const fetchBalance = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const res = await fetch("/api/marketplace/wallet");
      if (res.ok) {
        const data = await res.json();
        setWalletData({
          balance: data.balance ?? 0,
          solana_deposit_address: data.solana_deposit_address ?? null,
          evm_deposit_address: data.evm_deposit_address ?? null,
        });
      }
    } catch {
      // Silent fail -- wallet may not exist yet
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    if (showModal && user && !isFree) {
      fetchBalance();
    }
  }, [showModal, user, isFree, fetchBalance]);

  const handleOpenModal = () => {
    setError("");
    setDelivery(null);
    setShowModal(true);
  };

  const handlePurchase = async () => {
    // Validate guest fields for free items
    if (isGuest && isFree) {
      if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    setPurchasing(true);
    setError("");

    try {
      const body: Record<string, any> = {
        listing_id: listingId,
        payment_method: "balance",
      };

      // Add guest info for unauthenticated free purchases
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
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setPurchasing(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const insufficientBalance =
    walletData != null && price != null && walletData.balance < price;

  // Contact seller — handled by ContactForm component
  if (pricingType === "contact") {
    return null;
  }

  // Button label
  const buttonLabel = isFree
    ? "Get Free"
    : `Buy Now \u2014 ${price != null ? formatCurrency(price, currency) : ""}`;

  return (
    <>
      <Button
        className="bg-neon text-background hover:bg-neon/90 gap-2"
        onClick={handleOpenModal}
      >
        {!isFree && <ShoppingCart className="h-4 w-4 shrink-0" />}
        <span className="truncate">{buttonLabel}</span>
      </Button>

      {/* Modal overlay */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !purchasing) setShowModal(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
            {/* Close button */}
            {!purchasing && (
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
                className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="max-h-[85vh] overflow-y-auto p-6">
              {/* ───── Success state ───── */}
              {delivery ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <h3 className="text-lg font-semibold">
                      {isFree ? "Access Granted!" : "Purchase Complete!"}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isFree
                      ? "You now have access. Here are your details:"
                      : "Your purchase was successful. Here are your delivery details:"}
                  </p>

                  <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/30 p-4">
                    {delivery.api_key && (
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          API Key
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                            {delivery.api_key}
                          </code>
                          <button
                            onClick={() =>
                              copyToClipboard(delivery.api_key!, "api_key")
                            }
                            aria-label="Copy API key"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === "api_key" ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {delivery.download_url && (
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Download
                        </p>
                        <a
                          href={delivery.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-neon hover:underline break-all"
                        >
                          Download File
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}

                    {delivery.access_url && (
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Access URL
                        </p>
                        <a
                          href={delivery.access_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-neon hover:underline break-all"
                        >
                          Open Access Link
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}

                    {delivery.instructions && (
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Instructions
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {delivery.instructions}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowModal(false)}
                    >
                      Close
                    </Button>
                    {user && (
                      <Button asChild className="flex-1 bg-neon text-background hover:bg-neon/90">
                        <Link href="/orders">View Orders</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ) : isGuest && isFree ? (
                /* ───── Guest checkout for free items ───── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10">
                      <Mail className="h-5 w-5 text-neon" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Get Free Access</h3>
                      <p className="text-xs text-muted-foreground">No account required</p>
                    </div>
                  </div>

                  {sellerName && (
                    <p className="text-sm text-muted-foreground">
                      From <span className="text-foreground">{sellerName}</span>
                    </p>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="guest-email" className="mb-1.5 block text-sm font-medium">
                        Email address <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="guest-email"
                        type="email"
                        placeholder="you@example.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        required
                        autoFocus
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Delivery details will be sent to this email
                      </p>
                    </div>
                    <div>
                      <label htmlFor="guest-name" className="mb-1.5 block text-sm font-medium">
                        Name <span className="text-muted-foreground text-xs">(optional)</span>
                      </label>
                      <input
                        id="guest-name"
                        type="text"
                        placeholder="Your name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="break-words">{error}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowModal(false)}
                      disabled={purchasing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-neon text-background hover:bg-neon/90"
                      disabled={purchasing}
                      onClick={handlePurchase}
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Get Access"
                      )}
                    </Button>
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login?redirect=/marketplace" className="text-neon hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              ) : isGuest && !isFree ? (
                /* ───── Guest on paid item — needs account for wallet ───── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10">
                      <Wallet className="h-5 w-5 text-neon" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Sign in to Purchase</h3>
                    </div>
                  </div>

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
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button asChild className="flex-1 bg-neon text-background hover:bg-neon/90">
                      <Link href="/login?redirect=/marketplace">Sign In</Link>
                    </Button>
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup?redirect=/marketplace" className="text-neon hover:underline">
                      Sign up free
                    </Link>
                  </p>
                </div>
              ) : user && isFree ? (
                /* ───── Logged-in user on free item — simple confirm ───── */
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Confirm Free Access</h3>

                  {sellerName && (
                    <p className="text-sm text-muted-foreground">
                      From <span className="text-foreground">{sellerName}</span>
                    </p>
                  )}

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
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowModal(false)}
                      disabled={purchasing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-neon text-background hover:bg-neon/90"
                      disabled={purchasing}
                      onClick={handlePurchase}
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Get Access"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* ───── Logged-in user on paid item — wallet confirmation ───── */
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Confirm Purchase</h3>

                  {sellerName && (
                    <p className="text-sm text-muted-foreground">
                      From <span className="text-foreground">{sellerName}</span>
                    </p>
                  )}

                  {/* Price summary */}
                  <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Item Price</span>
                      <span className="font-semibold text-foreground">
                        {price != null ? formatCurrency(price, currency) : "Free"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Wallet Balance
                      </span>
                      {loadingWallet ? (
                        <span className="inline-block h-5 w-16 animate-pulse rounded bg-secondary" />
                      ) : (
                        <span
                          className={`font-semibold ${
                            insufficientBalance
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {formatCurrency(walletData?.balance ?? 0)}
                        </span>
                      )}
                    </div>
                    {insufficientBalance && price != null && (
                      <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2">
                        <span className="text-muted-foreground">
                          Amount Needed
                        </span>
                        <span className="font-semibold text-red-400">
                          {formatCurrency(
                            price - (walletData?.balance ?? 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="break-words">{error}</span>
                    </div>
                  )}

                  {/* Insufficient balance -- show deposit addresses */}
                  {insufficientBalance && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                      <p className="text-sm font-medium text-amber-400">
                        Insufficient balance
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Deposit USDC to fund your wallet:
                      </p>

                      {walletData?.solana_deposit_address && (
                        <div className="space-y-1 min-w-0">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Solana
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
                              {walletData.solana_deposit_address}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  walletData.solana_deposit_address!,
                                  "sol_modal"
                                )
                              }
                              aria-label="Copy Solana address"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              {copiedField === "sol_modal" ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {walletData?.evm_deposit_address && (
                        <div className="space-y-1 min-w-0">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Base / Polygon
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
                              {walletData.evm_deposit_address}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  walletData.evm_deposit_address!,
                                  "evm_modal"
                                )
                              }
                              aria-label="Copy EVM address"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              {copiedField === "evm_modal" ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                      >
                        <Link href="/wallet">Go to Wallet</Link>
                      </Button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowModal(false)}
                      disabled={purchasing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-neon text-background hover:bg-neon/90"
                      disabled={
                        purchasing || loadingWallet || insufficientBalance
                      }
                      onClick={handlePurchase}
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Confirm Purchase"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
