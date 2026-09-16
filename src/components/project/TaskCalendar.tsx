import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
}

interface TaskCalendarProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function TaskCalendar({ tasks, onTaskClick }: TaskCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [tasksOnDate, setTasksOnDate] = useState<Task[]>([]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const filtered = tasks.filter((task) => {
        if (!task.due_date) return false;
        const taskDate = format(new Date(task.due_date), "yyyy-MM-dd");
        return taskDate === dateStr;
      });
      setTasksOnDate(filtered);
    }
  }, [selectedDate, tasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "backlog":
        return "bg-slate-500";
      case "todo":
        return "bg-primary";
      case "in_progress":
        return "bg-yellow-500";
      case "done":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDatesWithTasks = () => {
    return tasks
      .filter((task) => task.due_date)
      .map((task) => new Date(task.due_date!));
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Calendar */}
      <Card className="p-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md"
          modifiers={{
            hasTasks: getDatesWithTasks(),
          }}
          modifiersClassNames={{
            hasTasks: "bg-primary/10 font-bold",
          }}
        />
      </Card>

      {/* Tasks for Selected Date */}
      <Card className="flex-1 p-4">
        <h3 className="font-semibold mb-4">
          {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
        </h3>

        <div className="space-y-2">
          {tasksOnDate.length > 0 ? (
            tasksOnDate.map((task) => (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{task.title}</h4>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {task.description}
                  </p>
                )}
                {task.due_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(task.due_date), "h:mm a")}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tasks scheduled for this date
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
