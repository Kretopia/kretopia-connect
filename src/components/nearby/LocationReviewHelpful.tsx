import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LocationReviewHelpfulProps {
  reviewId: string;
}

export function LocationReviewHelpful({ reviewId }: LocationReviewHelpfulProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [isHelpful, setIsHelpful] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHelpful();
  }, [reviewId]);

  const fetchHelpful = async () => {
    const { count: total } = await supabase
      .from('location_review_helpful')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', reviewId);
    setCount(total || 0);

    if (user) {
      const { data } = await supabase
        .from('location_review_helpful')
        .select('id')
        .eq('review_id', reviewId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsHelpful(!!data);
    }
  };

  const toggle = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      if (isHelpful) {
        await supabase
          .from('location_review_helpful')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id);
        setCount(c => Math.max(0, c - 1));
        setIsHelpful(false);
      } else {
        await supabase
          .from('location_review_helpful')
          .insert({ review_id: reviewId, user_id: user.id });
        setCount(c => c + 1);
        setIsHelpful(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-6 text-[10px] gap-1 px-1.5 ${isHelpful ? 'text-primary' : 'text-muted-foreground'}`}
      onClick={toggle}
      disabled={!user || loading}
    >
      <ThumbsUp className={`h-3 w-3 ${isHelpful ? 'fill-primary' : ''}`} />
      {count > 0 ? `Helpful (${count})` : 'Helpful'}
    </Button>
  );
}
