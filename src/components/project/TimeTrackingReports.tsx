import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface TimeTrackingReportsProps {
  projectId: string;
}

interface TimeEntry {
  id: string;
  user_id: string;
  task_name: string;
  duration: number;
  date: string;
  user_name: string;
}

export const TimeTrackingReports = ({ projectId }: TimeTrackingReportsProps) => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("week");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const loadTimeEntries = async () => {
    try {
      let startDate: Date;
      let endDate: Date = new Date();

      switch (dateRange) {
        case "week":
          startDate = startOfWeek(new Date());
          endDate = endOfWeek(new Date());
          break;
        case "month":
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
        default:
          startDate = new Date(0);
      }

      const { data, error } = await supabase
        .from("time_entries" as any)
        .select(`
          *,
          profiles:user_id (
            full_name
          )
        `)
        .eq("project_id", projectId)
        .gte("date", startDate.toISOString())
        .lte("date", endDate.toISOString());

      if (error) throw error;

      const entries: TimeEntry[] = (data || []).map((entry: any) => ({
        id: entry.id,
        user_id: entry.user_id,
        task_name: entry.task_name,
        duration: entry.duration,
        date: entry.date,
        user_name: entry.profiles?.full_name || "Unknown",
      }));

      setTimeEntries(entries);
    } catch (error) {
      console.error("Error loading time entries:", error);
      toast({
        title: "Error",
        description: "Failed to load time entries",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadTimeEntries();
  }, [projectId, dateRange]);

  const getTotalHours = () => {
    return timeEntries.reduce((sum, entry) => sum + entry.duration, 0) / 60;
  };

  const getHoursByUser = () => {
    const userHours: { [key: string]: number } = {};
    timeEntries.forEach((entry) => {
      if (!userHours[entry.user_name]) {
        userHours[entry.user_name] = 0;
      }
      userHours[entry.user_name] += entry.duration / 60;
    });
    return userHours;
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const userHours = getHoursByUser();
      const totalHours = getTotalHours();

      const reportData = {
        project_id: projectId,
        date_range: dateRange,
        total_hours: totalHours,
        user_hours: userHours,
        entries: timeEntries,
        generated_at: new Date().toISOString(),
      };

      // Create downloadable report
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `time-report-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();

      toast({
        title: "Report Generated",
        description: "Your time tracking report has been downloaded",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const userHours = getHoursByUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time Tracking Reports
        </CardTitle>
        <CardDescription>
          View detailed time tracking analytics and reports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateReport} disabled={isGenerating}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {getTotalHours().toFixed(1)}h
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{timeEntries.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Hours by Team Member</h4>
          {Object.entries(userHours).map(([userName, hours]) => (
            <div key={userName} className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm font-medium">{userName}</span>
              <span className="text-sm text-muted-foreground">
                {hours.toFixed(1)}h
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
