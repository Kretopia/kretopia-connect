import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Target, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface IncomeGoalTrackerProps {
  currentIncome: number;
  currencySymbol: string;
}

export function IncomeGoalTracker({ currentIncome, currencySymbol }: IncomeGoalTrackerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goal, setGoal] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("income_goals")
      .select("target_amount")
      .eq("user_id", user.id)
      .eq("period", "monthly")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setGoal(Number(data.target_amount));
      });
  }, [user]);

  const saveGoal = async () => {
    if (!user || !inputValue) return;
    const amount = Number(inputValue);
    if (amount <= 0) return;

    const { error } = await supabase.from("income_goals").upsert(
      { user_id: user.id, target_amount: amount, period: "monthly", updated_at: new Date().toISOString() },
      { onConflict: "user_id,period" }
    );

    if (!error) {
      setGoal(amount);
      setEditing(false);
      toast({ title: "Goal set!" });
    }
  };

  const progress = goal > 0 ? Math.min((currentIncome / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - currentIncome, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Monthly Goal
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(!editing); setInputValue(String(goal || "")); }}>
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="e.g. 5000"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="h-8 text-sm"
              min="1"
            />
            <Button size="sm" className="h-8 px-3" onClick={saveGoal}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : goal > 0 ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">{currencySymbol}{currentIncome.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">of {currencySymbol}{goal.toFixed(0)} goal</p>
              </div>
              <span className="text-lg font-semibold text-primary">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">{currencySymbol}{remaining.toFixed(0)} to go this month</p>
            )}
            {progress >= 100 && (
              <p className="text-xs text-green-500 font-medium">Goal reached!</p>
            )}
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground mb-2">Set a monthly income goal</p>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Set Goal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
