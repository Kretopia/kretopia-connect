import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, FolderOpen, Plus, FileText, Image as ImageIcon, Film, Music, File, ArrowRight, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkspaceQuickPanelProps {
  tasks: Array<{
    id: string;
    title: string;
    status: string | null;
    assigned_to: string | null;
  }>;
  files: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_size: number | null;
    file_type: string | null;
    created_at: string;
  }>;
  collaborators: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  }>;
  projectId: string;
  currentUserId: string;
  onTasksChanged: () => void;
  onNavigateToTab: (tab: string) => void;
}

export function WorkspaceQuickPanel({ tasks, files, collaborators, projectId, currentUserId, onTasksChanged, onNavigateToTab }: WorkspaceQuickPanelProps) {
  const { toast } = useToast();

  const pendingTasks = tasks.filter(t => t.status !== 'done').slice(0, 5);
  const recentFiles = files.slice(0, 4);
  const completedCount = tasks.filter(t => t.status === 'done').length;

  const handleToggleTask = async (taskId: string, currentStatus: string | null) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
      if (error) throw error;
      onTasksChanged();
    } catch (error: any) {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-4 w-4" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Film className="h-4 w-4" />;
    if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-4 space-y-6">
      {/* Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            Tasks
          </h3>
          <button 
            onClick={() => onNavigateToTab('tasks')}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{completedCount} of {tasks.length} complete</span>
              <span>{Math.round((completedCount / tasks.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          {pendingTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors group"
            >
              <Checkbox
                checked={task.status === 'done'}
                onCheckedChange={() => handleToggleTask(task.id, task.status)}
                className="h-4 w-4"
              />
              <span className="text-sm truncate flex-1">{task.title}</span>
            </div>
          ))}
          {pendingTasks.length === 0 && tasks.length > 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">All tasks complete!</p>
          )}
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No tasks yet</p>
          )}
        </div>
      </div>

      {/* Files Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-secondary" />
            Files
          </h3>
          <button 
            onClick={() => onNavigateToTab('files')}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-1">
          {recentFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="text-muted-foreground shrink-0">
                {getFileIcon(file.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.file_name}</p>
                <p className="text-[11px] text-muted-foreground">{formatFileSize(file.file_size)}</p>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No files yet</p>
          )}
        </div>
      </div>

      {/* Team Section */}
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-accent" />
          Team ({collaborators.length})
        </h3>
        <div className="space-y-1">
          {collaborators.slice(0, 5).map((collab) => (
            <div key={collab.id} className="flex items-center gap-2.5 p-2 rounded-md">
              <Avatar className="h-6 w-6">
                <AvatarImage src={collab.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{collab.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{collab.full_name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
