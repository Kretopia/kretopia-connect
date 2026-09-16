import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function useWishlist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wishlists")
      .select("product_id")
      .eq("user_id", user.id);
    if (data) setWishlistIds(new Set(data.map((w: any) => w.product_id)));
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const toggleWishlist = useCallback(async (productId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to save listings", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (wishlistIds.has(productId)) {
        await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
        setWishlistIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
        toast({ title: "Removed from saved" });
      } else {
        await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
        setWishlistIds(prev => new Set(prev).add(productId));
        toast({ title: "Saved! ❤", description: "Added to your saved listings" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, wishlistIds, toast]);

  return { wishlistIds, toggleWishlist, loading, fetchWishlist };
}
