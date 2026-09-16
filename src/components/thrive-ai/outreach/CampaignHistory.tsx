import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertCircle, BarChart3, CalendarClock, CheckCircle2, Copy, Eye, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  campaigns: any[];
  onDuplicate: (subject: string, body: string) => void;
}

export const CampaignHistory = ({ campaigns, onDuplicate }: Props) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (campaigns.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5" /> Campaign History
      </p>
      {campaigns.map((c: any) => (
        <Card
          key={c.id}
          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpanded(expanded === c.id ? null : c.id)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{c.name || c.subject}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.subject}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className={`text-[10px] px-1.5 py-0 ${c.status === "sent" ? "bg-green-500/10 text-green-600" : c.status === "scheduled" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {c.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(c.subject || "", c.body || "");
                    toast.success("Campaign duplicated — edit and send!");
                  }}>
                    <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(expanded === c.id ? null : c.id);
                  }}>
                    <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            {c.sent_count > 0 && <span className="flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5 text-green-500" /> {c.sent_count} sent</span>}
            {c.failed_count > 0 && <span className="flex items-center gap-0.5"><AlertCircle className="h-2.5 w-2.5 text-destructive" /> {c.failed_count} failed</span>}
            {c.sent_at && <span>{format(new Date(c.sent_at), "MMM d, yyyy h:mm a")}</span>}
            {!c.sent_at && c.scheduled_for && <span className="flex items-center gap-0.5"><CalendarClock className="h-2.5 w-2.5" /> {format(new Date(c.scheduled_for), "MMM d, yyyy h:mm a")}</span>}
          </div>
          {expanded === c.id && (
            <div className="mt-3 pt-3 border-t border-border space-y-2" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Subject</p>
                <p className="text-xs">{c.subject}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Body</p>
                <p className="text-xs whitespace-pre-wrap max-h-40 overflow-y-auto bg-muted/30 rounded p-2">{c.body}</p>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>Total: {c.total_recipients}</span>
                <span>Sent: {c.sent_count}</span>
                <span>Failed: {c.failed_count}</span>
                {c.open_count > 0 && <span>Opens: {c.open_count}</span>}
                {c.click_count > 0 && <span>Clicks: {c.click_count}</span>}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
