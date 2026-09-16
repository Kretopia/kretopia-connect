import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useNavigate } from "react-router-dom";
import { BuyerOrderCard } from "@/components/orders/BuyerOrderCard";
import { SellerOrderCard } from "@/components/orders/SellerOrderCard";
import {
  Package,
  DollarSign,
  ShoppingBag,
  Store,
  TrendingUp,
  ExternalLink,
  Shield,
  AlertTriangle,
  Clock,
} from "lucide-react";

export default function MyPurchases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [salesStats, setSalesStats] = useState({
    total: 0,
    count: 0,
    thisMonth: 0,
    escrowHeld: 0,
    pendingCount: 0,
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Fetch buyer orders
      const { data: buyerData } = await supabase
        .from("marketplace_orders")
        .select(`
          *,
          listing:digital_products(id, title, preview_urls, product_type)
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch seller profiles for buyer orders
      const buyerOrdersWithSellers = await Promise.all(
        (buyerData || []).map(async (order) => {
          const { data: sellerProfile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", order.seller_id)
            .single();
          return { ...order, seller: sellerProfile };
        })
      );
      setBuyerOrders(buyerOrdersWithSellers);

      // Fetch seller orders
      const { data: sellerData } = await supabase
        .from("marketplace_orders")
        .select(`
          *,
          listing:digital_products(id, title, preview_urls, product_type)
        `)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch buyer profiles for seller orders
      const sellerOrdersWithBuyers = await Promise.all(
        (sellerData || []).map(async (order) => {
          const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", order.buyer_id)
            .single();
          return { ...order, buyer: buyerProfile };
        })
      );
      setSellerOrders(sellerOrdersWithBuyers);

      // Calculate stats
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const stats = sellerOrdersWithBuyers.reduce(
        (acc, order) => {
          const sellerAmount = order.amount - (order.platform_fee || 0);
          if (order.status === "completed") {
            acc.total += sellerAmount;
            acc.count += 1;
            if (new Date(order.created_at) >= thisMonth) {
              acc.thisMonth += sellerAmount;
            }
          }
          if (order.status === "escrow") {
            acc.escrowHeld += sellerAmount;
            acc.pendingCount += 1;
          }
          return acc;
        },
        { total: 0, count: 0, thisMonth: 0, escrowHeld: 0, pendingCount: 0 }
      );
      setSalesStats(stats);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({ title: "Error", description: "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterOrders = (orders: any[], filter: string) => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.status === filter);
  };

  const filteredBuyerOrders = filterOrders(buyerOrders, buyerFilter);
  const filteredSellerOrders = filterOrders(sellerOrders, sellerFilter);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <>
      <SEO title="Purchases & Sales - Kretopia" />
      <div className="container mx-auto py-8 px-4 max-w-6xl min-h-screen pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Purchases & Sales</h1>
        </div>

        {/* Stats Dashboard */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${salesStats.total.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{salesStats.count} completed sales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${salesStats.thisMonth.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                In Escrow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                ${salesStats.escrowHeld.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {salesStats.pendingCount} pending {salesStats.pendingCount === 1 ? "order" : "orders"}
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/thrivepay")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Manage</div>
              <p className="text-xs text-muted-foreground">Payouts & Balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders */}
        <Tabs defaultValue="purchases" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="purchases" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Purchases ({buyerOrders.length})
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Sales ({sellerOrders.length})
              {salesStats.pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {salesStats.pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Purchases Tab */}
          <TabsContent value="purchases" className="space-y-4">
            {buyerOrders.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filteredBuyerOrders.length} orders</p>
                <Select value={buyerFilter} onValueChange={setBuyerFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="escrow">In Escrow</SelectItem>
                    <SelectItem value="disputed">Disputed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {filteredBuyerOrders.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">
                  {buyerFilter !== "all" ? "No orders match this filter" : "No purchases yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Browse the marketplace to find amazing creative products & services
                </p>
                <Button onClick={() => navigate("/market")}>Browse Market</Button>
              </Card>
            ) : (
              filteredBuyerOrders.map((order) => (
                <BuyerOrderCard key={order.id} order={order} onAction={fetchData} />
              ))
            )}
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            {/* Pending action alert */}
            {salesStats.pendingCount > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="flex items-center gap-3 py-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {salesStats.pendingCount} {salesStats.pendingCount === 1 ? "order needs" : "orders need"} fulfillment
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ship items or complete services to release payment
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {sellerOrders.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filteredSellerOrders.length} orders</p>
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="escrow">In Escrow</SelectItem>
                    <SelectItem value="disputed">Disputed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {filteredSellerOrders.length === 0 ? (
              <Card className="p-8 text-center">
                <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">
                  {sellerFilter !== "all" ? "No orders match this filter" : "No sales yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  List products or services in the marketplace to start selling
                </p>
                <Button onClick={() => navigate("/market")}>Go to Market</Button>
              </Card>
            ) : (
              filteredSellerOrders.map((order) => (
                <SellerOrderCard key={order.id} order={order} onAction={fetchData} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
