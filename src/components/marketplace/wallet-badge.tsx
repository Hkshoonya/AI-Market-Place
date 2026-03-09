"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { SWR_TIERS } from "@/lib/swr/config";

interface WalletResponse {
  balance: number;
}

export function WalletBadge() {
  const router = useRouter();
  const { user } = useAuth();

  const { data } = useSWR<WalletResponse>(
    user ? "/api/marketplace/wallet" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  const balance = data?.balance ?? null;

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
