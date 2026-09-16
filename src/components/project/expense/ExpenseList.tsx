import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getCategoryInfo } from "./ExpenseCategories";

interface ExpenseListProps {
  expenses: any[];
  onRefresh: () => void;
}

export function ExpenseList({ expenses, onRefresh }: ExpenseListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Expense deleted"); onRefresh(); }
    setDeleting(null);
  };

  if (expenses.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-sm">No expenses recorded yet</p>
        <p className="text-xs mt-1">Add your first expense to start tracking</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Date</TableHead>
          <TableHead className="text-xs">Category</TableHead>
          <TableHead className="text-xs">Description</TableHead>
          <TableHead className="text-xs">Vendor</TableHead>
          <TableHead className="text-xs text-right">Amount</TableHead>
          <TableHead className="text-xs w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((exp) => {
          const cat = getCategoryInfo(exp.category);
          return (
            <TableRow key={exp.id}>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(exp.date), "MMM d")}
              </TableCell>
              <TableCell>
                <span className="text-xs flex items-center gap-1">
                  {cat.icon} {cat.label}
                </span>
              </TableCell>
              <TableCell className="text-xs max-w-[180px] truncate">
                <div className="flex items-center gap-1">
                  {exp.title}
                  {exp.is_recurring && <Repeat className="h-3 w-3 text-amber-500" />}
                  {exp.tax_deductible && <Badge variant="outline" className="text-[8px] px-1 py-0">TAX</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{exp.vendor || "—"}</TableCell>
              <TableCell className="text-xs text-right font-medium text-red-600">
                -${Number(exp.amount).toFixed(2)}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  disabled={deleting === exp.id} onClick={() => handleDelete(exp.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
