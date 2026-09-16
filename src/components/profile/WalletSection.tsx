import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  Unlink,
  Shield,
  Star,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { useWalletConnection, WalletConnection } from "@/hooks/useWalletConnection";
import { useToast } from "@/hooks/use-toast";

interface WalletSectionProps {
  isOwnProfile: boolean;
  userId?: string;
}

const formatAddress = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const WalletItem = ({
  wallet,
  isOwn,
  onDisconnect,
  onSetPrimary,
  getChainName,
}: {
  wallet: WalletConnection;
  isOwn: boolean;
  onDisconnect: (id: string) => void;
  onSetPrimary: (id: string) => void;
  getChainName: (chainId: number) => string;
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wallet.wallet_address);
    setCopied(true);
    toast({ title: "Address copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Wallet className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {formatAddress(wallet.wallet_address)}
            </span>
            {wallet.is_primary && (
              <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                <Star className="h-2.5 w-2.5" /> Primary
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{getChainName(wallet.chain_id)}</span>
            <span>·</span>
            <span className="capitalize">{wallet.wallet_type}</span>
            {wallet.label && (
              <>
                <span>·</span>
                <span>{wallet.label}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a
            href={`https://basescan.org/address/${wallet.wallet_address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
        {isOwn && !wallet.is_primary && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onSetPrimary(wallet.id)}
            title="Set as primary"
          >
            <Star className="h-3.5 w-3.5" />
          </Button>
        )}
        {isOwn && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDisconnect(wallet.id)}
            title="Disconnect wallet"
          >
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const WalletSection = ({ isOwnProfile }: WalletSectionProps) => {
  const {
    wallets: savedWallets,
    isLoading,
    isConnecting,
    saveWalletAddress,
    disconnectWallet,
    setPrimary,
    getChainName,
  } = useWalletConnection();

  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const hasWallets = savedWallets.length > 0;

  const handleAddWallet = async () => {
    if (!walletAddress.trim() || walletAddress.length < 10) return;
    await saveWalletAddress(walletAddress.trim());
    setWalletAddress("");
    setShowAddForm(false);
  };

  if (!isOwnProfile && !hasWallets) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          On-Chain Identity
        </h2>
        {hasWallets && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1 text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> {savedWallets.length} wallet{savedWallets.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        )}
      </div>

      {!hasWallets && isOwnProfile && (
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit mb-3">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Add On-Chain Verification</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Link your wallet address to unlock secure on-chain agreements,
              escrow payments, and verified credentials.
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              <Input
                placeholder="Paste your wallet address (0x...)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
              <Button
                onClick={handleAddWallet}
                disabled={!walletAddress.trim() || isConnecting}
                className="w-full"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">✔ Funds locked securely</span>
              <span className="flex items-center gap-1">✔ Transparent</span>
              <span className="flex items-center gap-1">✔ No chargebacks</span>
            </div>
          </CardContent>
        </Card>
      )}

      {hasWallets && (
        <div className="space-y-2">
          {savedWallets
            .filter((w) => expanded || w.is_primary || savedWallets.length <= 2)
            .map((wallet) => (
              <WalletItem
                key={wallet.id}
                wallet={wallet}
                isOwn={isOwnProfile}
                onDisconnect={disconnectWallet}
                onSetPrimary={setPrimary}
                getChainName={getChainName}
              />
            ))}

          {isOwnProfile && (
            <div className="mt-2">
              {showAddForm ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste wallet address (0x...)"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddWallet} disabled={!walletAddress.trim() || isConnecting} size="sm">
                    {isConnecting ? "..." : "Add"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Another Wallet
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
