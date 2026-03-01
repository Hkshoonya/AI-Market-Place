"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function WalletBadge() {
  const router = useRouter();
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }

    let cancelled = false;

    async function fetchBalance() {
      try {
        const res = await fetch("/api/marketplace/wallet");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setBalance(data.balance ?? null);
        }
      } catch {
        // Silent fail
      }
    }

    fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (balance == null) return null;

  return (
    <button
      onClick={() => router.push("/wallet")}
      className="bg-zinc-800 px-3 py-1 rounded-full text-sm text-emerald-400 cursor-pointer hover:bg-zinc-700 transition-colors"
    >
      {"\uD83D\uDCB0"} ${balance.toFixed(2)}
    </button>
  );
}
