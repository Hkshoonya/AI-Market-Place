import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";

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
  const { data, isLoading, mutate } = useSWR<WalletBalance>(
    enabled ? "/api/marketplace/wallet" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  return {
    walletData: data ?? null,
    loadingWallet: isLoading,
    refetch: () => { mutate(); },
  };
}
