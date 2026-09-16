import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  CheckSquare, 
  DollarSign, 
  FileText, 
  Users,
  Clock,
  Edit,
  Trash2,
  Archive
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityEvent {
  id: string;
  type: 'message' | 'task' | 'milestone' | 'file' | 'collaborator' | 'project' | 'time_entry';
  action: string;
  user_name: string;
  user_avatar?: string;
  created_at: string;
  metadata?: any;
}

interface ActivityTimelineProps {
  projectId: string;
}

export function ActivityTimeline({ projectId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    
    // Real-time subscriptions for activity updates
    const messagesChannel = supabase
      .channel(`timeline-messages-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_messages',
        filter: `project_id=eq.${projectId}`
      }, () => fetchActivities())
      .subscribe();

    const tasksChannel = supabase
      .channel(`timeline-tasks-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_tasks',
        filter: `project_id=eq.${projectId}`
      }, () => fetchActivities())
      .subscribe();

    const milestonesChannel = supabase
      .channel(`timeline-milestones-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'milestones',
        filter: `project_id=eq.${projectId}`
      }, () => fetchActivities())
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(milestonesChannel);
    };
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      const activities: ActivityEvent[] = [];

      // Fetch messages
      const { data: messagesData } = await supabase
        .from('project_messages')
        .select('id, message, created_at, user_id, file_name')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (messagesData && messagesData.length > 0) {
        const messageUserIds = [...new Set(messagesData.map(m => m.user_id))];
        const { data: messageProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', messageUserIds);

        messagesData.forEach(msg => {
          const profile = messageProfiles?.find(p => p.user_id === msg.user_id);
          activities.push({
            id: `msg-${msg.id}`,
            type: 'message',
            action: msg.file_name ? `shared ${msg.file_name}` : msg.message.substring(0, 50),
            user_name: profile?.full_name || 'Unknown',
            user_avatar: profile?.avatar_url,
            created_at: msg.created_at,
            metadata: { hasFile: !!msg.file_name }
          });
        });
      }

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('project_tasks')
        .select('id, title, status, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (tasksData && tasksData.length > 0) {
        const taskUserIds = [...new Set(tasksData.map(t => t.created_by))];
        const { data: taskProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', taskUserIds);

        tasksData.forEach(task => {
          const profile = taskProfiles?.find(p => p.user_id === task.created_by);
          activities.push({
            id: `task-${task.id}`,
            type: 'task',
            action: `created task "${task.title}"`,
            user_name: profile?.full_name || 'Unknown',
            user_avatar: profile?.avatar_url,
            created_at: task.created_at,
            metadata: { status: task.status }
          });
        });
      }

      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from('milestones')
        .select('id, title, status, amount, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (milestonesData && milestonesData.length > 0) {
        const milestoneUserIds = [...new Set(milestonesData.map(m => m.created_by))];
        const { data: milestoneProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', milestoneUserIds);

        milestonesData.forEach(milestone => {
          const profile = milestoneProfiles?.find(p => p.user_id === milestone.created_by);
          let action = `created milestone "${milestone.title}"`;
          if (milestone.status === 'paid') {
            action = `paid milestone "${milestone.title}" ($${milestone.amount})`;
          } else if (milestone.status === 'completed') {
            action = `completed milestone "${milestone.title}"`;
          }
          
          activities.push({
            id: `milestone-${milestone.id}`,
            type: 'milestone',
            action,
            user_name: profile?.full_name || 'Unknown',
            user_avatar: profile?.avatar_url,
            created_at: milestone.created_at,
            metadata: { status: milestone.status, amount: milestone.amount }
          });
        });
      }

      // Fetch files
      const { data: filesData } = await supabase
        .from('project_files')
        .select('id, file_name, created_at, user_id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (filesData && filesData.length > 0) {
        const fileUserIds = [...new Set(filesData.map(f => f.user_id))];
        const { data: fileProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', fileUserIds);

        filesData.forEach(file => {
          const profile = fileProfiles?.find(p => p.user_id === file.user_id);
          activities.push({
            id: `file-${file.id}`,
            type: 'file',
            action: `uploaded ${file.file_name}`,
            user_name: profile?.full_name || 'Unknown',
            user_avatar: profile?.avatar_url,
            created_at: file.created_at
          });
        });
      }

      // Sort all activities by date
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setActivities(activities.slice(0, 50)); // Keep last 50 activities
      setLoading(false);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setLoading(false);
    }
  };

  const getIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'message': return MessageSquare;
      case 'task': return CheckSquare;
      case 'milestone': return DollarSign;
      case 'file': return FileText;
      case 'collaborator': return Users;
      case 'time_entry': return Clock;
      case 'project': return Edit;
      default: return MessageSquare;
    }
  };

  const getIconColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'message': return 'text-primary';
      case 'task': return 'text-green-500';
      case 'milestone': return 'text-primary';
      case 'file': return 'text-orange-500';
      case 'collaborator': return 'text-primary';
      case 'time_entry': return 'text-primary';
      default: return 'text-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="px-4 py-3">
              {activities.map((activity, index) => {
                const Icon = getIcon(activity.type);
                const iconColor = getIconColor(activity.type);
                
                return (
                  <div key={activity.id} className="relative">
                    {index !== activities.length - 1 && (
                      <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                    )}
                    <div className="flex gap-3 pb-4">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={activity.user_avatar} />
                          <AvatarFallback className="text-xs">
                            {activity.user_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background border-2 border-background flex items-center justify-center ${iconColor}`}>
                          <Icon className="h-2.5 w-2.5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold">{activity.user_name}</span>
                              {' '}
                              <span className="text-muted-foreground">{activity.action}</span>
                            </p>
                            {activity.metadata?.status && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {activity.metadata.status}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
