import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface WalletConnection {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_type: string;
  chain_id: number;
  is_primary: boolean;
  label: string | null;
  connected_at: string;
  last_used_at: string | null;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  137: "Polygon",
  84532: "Base Sepolia",
};

export function useWalletConnection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchWallets = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("wallet_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      setWallets((data as WalletConnection[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch wallets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Save a wallet address manually
  const saveWalletAddress = useCallback(async (address: string, chainId: number = 8453) => {
    if (!user) return;
    setIsConnecting(true);
    try {
      const normalizedAddress = address.toLowerCase();

      // Check if already saved
      const alreadySaved = wallets.find(
        (w) => w.wallet_address.toLowerCase() === normalizedAddress
      );
      if (alreadySaved) {
        toast({ title: "Wallet already linked" });
        return;
      }

      const isPrimary = wallets.length === 0;
      const { error } = await supabase.from("wallet_connections").insert({
        user_id: user.id,
        wallet_address: normalizedAddress,
        wallet_type: "external",
        chain_id: chainId,
        is_primary: isPrimary,
        label: "Manual",
      });
      if (!error) {
        toast({
          title: "Wallet connected!",
          description: `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)} linked to your profile.`,
        });
        fetchWallets();
      }
    } finally {
      setIsConnecting(false);
    }
  }, [user, wallets, toast, fetchWallets]);

  const connectExternalWallet = useCallback(async () => {
    if (!user) return;
    if (!(window as any).ethereum) {
      toast({
        title: "Wallet not found",
        description: "Please install MetaMask or another Web3 wallet to connect.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned");
      }

      const address = accounts[0].toLowerCase();
      const chainIdHex: string = await ethereum.request({ method: "eth_chainId" });
      const chainId = parseInt(chainIdHex, 16);

      // Check if already connected
      const existing = wallets.find(
        (w) => w.wallet_address.toLowerCase() === address
      );
      if (existing) {
        toast({
          title: "Already connected",
          description: "This wallet is already linked to your profile.",
        });
        return;
      }

      const isPrimary = wallets.length === 0;

      const { error } = await supabase.from("wallet_connections").insert({
        user_id: user.id,
        wallet_address: address,
        wallet_type: "external",
        chain_id: chainId,
        is_primary: isPrimary,
        label: "MetaMask",
      });

      if (error) throw error;

      toast({
        title: "Wallet connected!",
        description: `${address.slice(0, 6)}...${address.slice(-4)} linked to your profile.`,
      });

      await fetchWallets();
    } catch (err: any) {
      if (err?.code === 4001) {
        // User rejected
        return;
      }
      toast({
        title: "Connection failed",
        description: err.message || "Could not connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [user, wallets, toast, fetchWallets]);

  const disconnectWallet = useCallback(
    async (walletId: string) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from("wallet_connections")
          .delete()
          .eq("id", walletId)
          .eq("user_id", user.id);

        if (error) throw error;

        toast({
          title: "Wallet disconnected",
          description: "Wallet removed from your profile.",
        });

        await fetchWallets();
      } catch (err: any) {
        toast({
          title: "Error",
          description: "Failed to disconnect wallet",
          variant: "destructive",
        });
      }
    },
    [user, toast, fetchWallets]
  );

  const setPrimary = useCallback(
    async (walletId: string) => {
      if (!user) return;
      try {
        // Unset all primary
        await supabase
          .from("wallet_connections")
          .update({ is_primary: false })
          .eq("user_id", user.id);

        // Set new primary
        await supabase
          .from("wallet_connections")
          .update({ is_primary: true })
          .eq("id", walletId)
          .eq("user_id", user.id);

        toast({ title: "Primary wallet updated" });
        await fetchWallets();
      } catch {
        toast({
          title: "Error",
          description: "Failed to update primary wallet",
          variant: "destructive",
        });
      }
    },
    [user, toast, fetchWallets]
  );

  const primaryWallet = wallets.find((w) => w.is_primary) || wallets[0] || null;

  return {
    wallets,
    primaryWallet,
    isLoading,
    isConnecting,
    connectExternalWallet,
    disconnectWallet,
    setPrimary,
    fetchWallets,
    saveWalletAddress,
    getChainName: (chainId: number) => CHAIN_NAMES[chainId] || `Chain ${chainId}`,
  };
}
