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
    if (showModal && user) {
      fetchBalance();
    }
  }, [showModal, user, fetchBalance]);

  const handleOpenModal = () => {
    setError("");
    setDelivery(null);
    setShowModal(true);
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    setError("");

    try {
      const res = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          payment_method: "balance",
        }),
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

  // Free listing
  if (pricingType === "free") {
    return (
      <Button
        className="bg-neon text-background hover:bg-neon/90"
        onClick={handleOpenModal}
      >
        Free
      </Button>
    );
  }

  // Contact seller
  if (pricingType === "contact") {
    return null; // Handled by ContactForm component in listing page
  }

  // Paid listing
  return (
    <>
      <Button
        className="bg-neon text-background hover:bg-neon/90 gap-2"
        onClick={handleOpenModal}
      >
        <ShoppingCart className="h-4 w-4" />
        Buy Now {price != null ? `\u2014 ${formatCurrency(price, currency)}` : ""}
      </Button>

      {/* Modal overlay */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !purchasing) setShowModal(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-xl border border-border/50 bg-card shadow-2xl">
            {/* Close button */}
            {!purchasing && (
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
                className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="p-6">
              {/* Success state: delivery data */}
              {delivery ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">
                      Purchase Complete!
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your purchase was successful. Here are your delivery details:
                  </p>

                  <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/30 p-4">
                    {delivery.api_key && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          API Key
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
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
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Download
                        </p>
                        <a
                          href={delivery.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-neon hover:underline"
                        >
                          Download File
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {delivery.access_url && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Access URL
                        </p>
                        <a
                          href={delivery.access_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-neon hover:underline"
                        >
                          Open Access Link
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {delivery.instructions && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Instructions
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
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
                    <Button asChild className="flex-1 bg-neon text-background hover:bg-neon/90">
                      <Link href="/orders">View Orders</Link>
                    </Button>
                  </div>
                </div>
              ) : !user ? (
                /* Not logged in */
                <div className="space-y-4 text-center">
                  <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      Sign in to purchase
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You need to be logged in to make a purchase.
                    </p>
                  </div>
                  <div className="flex gap-2">
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
                </div>
              ) : (
                /* Confirmation / Insufficient balance */
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
                      <span>{error}</span>
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
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Solana
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
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
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            Base / Polygon
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-foreground">
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
