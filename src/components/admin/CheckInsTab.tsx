import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { MapPin } from "lucide-react";

export function CheckInsTab() {
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchCheckIns();
  }, []);

  const fetchCheckIns = async () => {
    try {
      const { data, error } = await supabase
        .from("user_check_ins")
        .select(`
          *,
          profiles!user_check_ins_user_id_fkey (
            full_name,
            avatar_url
          ),
          partner_locations (
            name,
            city,
            type
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setCheckIns(data || []);
    } catch (error) {
      console.error("Error fetching check-ins:", error);
      toast({
        title: "Error",
        description: "Failed to load check-ins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Recent Check-ins</h2>
        <Badge variant="outline">{checkIns.length} total</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkIns.map((checkIn) => (
              <TableRow key={checkIn.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {checkIn.profiles?.avatar_url && !failedAvatars.has(checkIn.id) ? (
                      <img
                        src={checkIn.profiles.avatar_url}
                        alt={checkIn.profiles.full_name}
                        loading="lazy"
                        onError={() => setFailedAvatars((prev) => new Set(prev).add(checkIn.id))}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs">
                          {checkIn.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <span className="font-medium">
                      {checkIn.profiles?.full_name || "Unknown"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {checkIn.partner_locations?.name || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {checkIn.partner_locations?.type || ""}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {checkIn.partner_locations?.city || "Unknown"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    +{checkIn.points_awarded} pts
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(checkIn.created_at).toLocaleDateString()}{" "}
                  {new Date(checkIn.created_at).toLocaleTimeString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
