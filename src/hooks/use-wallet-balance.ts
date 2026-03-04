import { useState, useCallback, useEffect } from "react";

export interface WalletBalance {
  balance: number;
  solana_deposit_address: string | null;
  evm_deposit_address: string | null;
}

interface UseWalletBalanceOptions {
  enabled: boolean;
}

interface UseWalletBalanceReturn {
  walletData: WalletBalance | null;
  loadingWallet: boolean;
  refetch: () => void;
}

export function useWalletBalance({ enabled }: UseWalletBalanceOptions): UseWalletBalanceReturn {
  const [walletData, setWalletData] = useState<WalletBalance | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

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
    if (enabled) {
      fetchBalance();
    }
  }, [enabled, fetchBalance]);

  return { walletData, loadingWallet, refetch: fetchBalance };
}
