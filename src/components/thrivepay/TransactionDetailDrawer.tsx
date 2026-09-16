import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PaymentStatusTimeline } from "./PaymentStatusTimeline";

export interface TransactionDetail {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  related_project_id?: string | null;
}

interface Props {
  transaction: TransactionDetail | null;
  onOpenChange: (open: boolean) => void;
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-500/10 text-green-600 border-green-500/30",
  paid: "bg-green-500/10 text-green-600 border-green-500/30",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  failed: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  refunded: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  disputed: "bg-red-500/10 text-red-600 border-red-500/30",
};

export function TransactionDetailDrawer({ transaction, onOpenChange }: Props) {
  const navigate = useNavigate();
  if (!transaction) return null;

  const isIn = transaction.type.includes("earned") || transaction.type.includes("received");
  const badgeCls = STATUS_BADGE[transaction.status] || "bg-muted text-muted-foreground border-border";
  // Not a payment method / card fragment — a short, safe internal reference
  // the user can quote in support conversations without exposing anything
  // sensitive.
  const safeRef = transaction.id.slice(0, 8).toUpperCase();

  return (
    <Sheet open={!!transaction} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl sm:max-w-lg sm:mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <div className={`rounded-full p-1.5 ${isIn ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {isIn ? <ArrowDownRight className="h-4 w-4 text-green-500" /> : <ArrowUpRight className="h-4 w-4 text-red-500" />}
            </div>
            {transaction.description || transaction.type.replace(/_/g, " ")}
          </SheetTitle>
          <SheetDescription>Reference {safeRef}</SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold ${isIn ? "text-green-500" : "text-red-500"}`}>
              {isIn ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
            </span>
            <Badge variant="outline" className={badgeCls}>
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <Row label="Date" value={new Date(transaction.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
            <Row label="Type" value={transaction.type.replace(/_/g, " ")} />
            <Row label="Reference" value={safeRef} />
          </div>

          <Separator />

          <div>
            <p className="text-xs text-muted-foreground mb-3">Status</p>
            <PaymentStatusTimeline createdAt={transaction.created_at} status={transaction.status} />
          </div>

          {transaction.related_project_id && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => navigate(`/desk/${transaction.related_project_id}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" /> View project
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
