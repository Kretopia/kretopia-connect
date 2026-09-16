import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface IndustryData {
  role_category: string;
  count: number;
}

interface IndustryMapProps {
  className?: string;
}

const ROLE_COLORS = [
  "bg-primary",
  "bg-accent",
  "bg-primary",
  "bg-green-500",
  "bg-primary",
  "bg-orange-500",
  "bg-primary",
  "bg-primary",
  "bg-yellow-500",
  "bg-red-500",
];

export function IndustryMap({ className }: IndustryMapProps) {
  const { user } = useAuth();
  const [industries, setIndustries] = useState<IndustryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchIndustryBreakdown();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchIndustryBreakdown = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_network_industry_breakdown', {
        p_user_id: user.id
      });

      if (error) {
        console.error('[IndustryMap] Error:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        const mapped = data.map((row: { role_category: string; count: number }) => ({
          role_category: row.role_category || 'Other',
          count: Number(row.count)
        }));
        setIndustries(mapped);
        setTotal(mapped.reduce((sum, item) => sum + item.count, 0));
      }
    } catch (err) {
      console.error('[IndustryMap] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (industries.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-6 text-center text-muted-foreground">
          <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Connect with creators to see your industry reach</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Industry Reach
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visual bar chart */}
        <div className="space-y-2">
          {industries.slice(0, 6).map((industry, index) => {
            const percentage = total > 0 ? (industry.count / total) * 100 : 0;
            const colorClass = ROLE_COLORS[index % ROLE_COLORS.length];
            
            return (
              <div key={industry.role_category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate max-w-[140px]" title={industry.role_category}>
                    {industry.role_category}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {industry.count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", colorClass)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {industries.length > 6 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            +{industries.length - 6} more industries in your network
          </p>
        )}

        {/* Total */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Network Reach</span>
            <span className="font-semibold">{total} creators</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
