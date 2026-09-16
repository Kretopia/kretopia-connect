import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, Square, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TimeEntry {
  id: string;
  description: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  is_billable: boolean;
  hourly_rate: number | null;
  task_id: string | null;
  tasks?: {
    title: string;
  };
}

interface TimeTrackerProps {
  projectId: string;
}

export function TimeTracker({ projectId }: TimeTrackerProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [description, setDescription] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("none");
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [isBillable, setIsBillable] = useState(true);

  useEffect(() => {
    fetchTimeEntries();
    fetchTasks();
    checkActiveEntry();
  }, [projectId]);

  const fetchTimeEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          tasks:project_tasks(title)
        `)
        .eq("project_id", projectId)
        .eq("user_id", user?.id)
        .order("start_time", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching time entries:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const checkActiveEntry = async () => {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user?.id)
        .is("end_time", null)
        .maybeSingle();

      if (error) throw error;
      setActiveEntry(data);
    } catch (error) {
      console.error("Error checking active entry:", error);
    }
  };

  const startTimer = async () => {
    if (!description.trim()) {
      toast.error("Please add a description");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          user_id: user?.id,
          project_id: projectId,
          task_id: selectedTaskId === "none" ? null : selectedTaskId,
          description,
          start_time: new Date().toISOString(),
          is_billable: isBillable,
          hourly_rate: hourlyRate || null
        })
        .select()
        .single();

      if (error) throw error;

      setActiveEntry(data);
      toast.success("Timer started!");
      setDescription("");
    } catch (error) {
      console.error("Error starting timer:", error);
      toast.error("Failed to start timer");
    }
  };

  const stopTimer = async () => {
    if (!activeEntry) return;

    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          end_time: new Date().toISOString()
        })
        .eq("id", activeEntry.id);

      if (error) throw error;

      setActiveEntry(null);
      fetchTimeEntries();
      toast.success("Timer stopped!");
    } catch (error) {
      console.error("Error stopping timer:", error);
      toast.error("Failed to stop timer");
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const calculateTotalTime = () => {
    return entries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  };

  const calculateTotalEarnings = () => {
    return entries
      .filter(e => e.is_billable && e.hourly_rate)
      .reduce((sum, entry) => {
        const hours = (entry.duration_minutes || 0) / 60;
        return sum + (hours * (entry.hourly_rate || 0));
      }, 0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Time Tracker</CardTitle>
          <CardDescription>Track time spent on this project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timer Controls */}
          {!activeEntry ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">What are you working on?</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the task..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task">Link to Task (Optional)</Label>
                  <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No task</SelectItem>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="rate">Hourly Rate ($)</Label>
                  <Input
                    id="rate"
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>

              <Button onClick={startTimer} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Start Timer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <p className="font-medium mb-2">{activeEntry.description}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 animate-pulse text-primary" />
                  <span>Timer running since {format(new Date(activeEntry.start_time), "p")}</span>
                </div>
              </div>
              <Button onClick={stopTimer} variant="destructive" className="w-full">
                <Square className="mr-2 h-4 w-4" />
                Stop Timer
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Time</p>
                <p className="font-semibold">{formatDuration(calculateTotalTime())}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="font-semibold">${calculateTotalEarnings().toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No time entries yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.start_time), "PPp")}
                      {entry.tasks && ` • ${entry.tasks.title}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatDuration(entry.duration_minutes)}
                    </p>
                    {entry.is_billable && entry.hourly_rate && (
                      <p className="text-sm text-muted-foreground">
                        ${((entry.duration_minutes || 0) / 60 * entry.hourly_rate).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
