import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowUpRight, ArrowDownRight, ExternalLink, CreditCard } from "lucide-react";
import { TooltipHint } from "@/components/ui/tooltip-hint";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const WalletCard = () => {
  const [wallet, setWallet] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string>('not_connected');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch wallet
    const { data: walletData } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletData) {
      setWallet(walletData);
    } else {
      const { data: newWallet } = await supabase
        .from('wallets')
        .insert({ user_id: user.id, credits: 10 })
        .select()
        .maybeSingle();
      setWallet(newWallet);
    }

    // Check payment account status
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_status')
      .eq('user_id', user.id)
      .single();
    
    if (profile?.stripe_account_status) {
      setPaymentStatus(profile.stripe_account_status);
    }

    // Fetch transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (transactions) setRecentTransactions(transactions);
  };

  return (
    <Card className="cursor-pointer hover:shadow-glow transition-smooth" onClick={() => navigate('/thrivepay')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-5 w-5" />
          Wallet
          <TooltipHint content="Credits are used for premium features. Connect your payment account to receive payments for your work." />
        </CardTitle>
        <div className="flex items-center gap-2">
          {paymentStatus === 'active' ? (
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Active
            </span>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/thrivepay?tab=payments');
              }}
            >
              Setup Payments
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Balance Display */}
          <div className="grid gap-3 grid-cols-2">
            <div className="rounded-lg bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
              <p className="text-xs text-primary-foreground/80">Credits</p>
              <p className="text-3xl font-bold text-primary-foreground">
                {wallet?.credits || 0}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-3xl font-bold">
                ${(wallet?.balance || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Recent Activity</h4>
            </div>
            <div className="space-y-2">
              {recentTransactions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No transactions yet
                </p>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="flex items-center gap-2">
                      {tx.type.includes('earned') || tx.type.includes('received') ? (
                        <div className="rounded-full bg-green-500/10 p-1.5">
                          <ArrowDownRight className="h-3 w-3 text-green-500" />
                        </div>
                      ) : (
                        <div className="rounded-full bg-red-500/10 p-1.5">
                          <ArrowUpRight className="h-3 w-3 text-red-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium line-clamp-1">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${
                      tx.type.includes('earned') || tx.type.includes('received') 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {tx.type.includes('earned') || tx.type.includes('received') ? '+' : '-'}
                      {tx.type.includes('credit') ? `${tx.amount}` : `$${tx.amount}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
