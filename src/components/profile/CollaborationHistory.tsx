import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, Calendar, Star, Users, Handshake } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Collaboration {
  project_id: string;
  project_title: string;
  project_status: string;
  role: string;
  started_at: string;
  collaborator_id: string;
  collaborator_name: string;
  collaborator_avatar: string;
  collaborator_role: string;
}

interface CollaborationHistoryProps {
  userId: string;
  isOwnProfile?: boolean;
  /** When viewing someone else's profile, show only shared collabs */
  viewerUserId?: string;
}

export function CollaborationHistory({ userId, isOwnProfile = false, viewerUserId }: CollaborationHistoryProps) {
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCollaborations();
  }, [userId, viewerUserId]);

  async function fetchCollaborations() {
    setLoading(true);
    try {
      // Get projects the user created or collaborated on
      const { data: ownedProjects } = await supabase
        .from('projects')
        .select('id, title, status, created_at, created_by')
        .eq('created_by', userId);

      const { data: collabRecords } = await supabase
        .from('project_collaborators')
        .select('project_id, role, created_at')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const allProjectIds = [
        ...(ownedProjects?.map(p => p.id) || []),
        ...(collabRecords?.map(c => c.project_id) || []),
      ];

      if (allProjectIds.length === 0) {
        setCollabs([]);
        setLoading(false);
        return;
      }

      const uniqueIds = [...new Set(allProjectIds)];

      // Get all collaborators on these projects
      const { data: allCollaborators } = await supabase
        .from('project_collaborators')
        .select('project_id, user_id, role, created_at')
        .in('project_id', uniqueIds)
        .eq('status', 'accepted')
        .neq('user_id', userId);

      // Also get project creators (they're collaborators too)
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, status, created_at, created_by')
        .in('id', uniqueIds);

      if (!projects) {
        setCollabs([]);
        setLoading(false);
        return;
      }

      // Gather all unique collaborator user IDs
      const collaboratorUserIds = new Set<string>();
      allCollaborators?.forEach(c => collaboratorUserIds.add(c.user_id));
      projects.forEach(p => {
        if (p.created_by !== userId) collaboratorUserIds.add(p.created_by);
      });

      if (collaboratorUserIds.size === 0) {
        setCollabs([]);
        setLoading(false);
        return;
      }

      // If viewing someone else's profile, filter to only shared projects
      if (viewerUserId && !isOwnProfile) {
        // Only show projects where the viewer is also a collaborator
        const sharedCollaboratorIds = new Set<string>();
        sharedCollaboratorIds.add(viewerUserId);
        
        // Filter to only those collaborators
        const filteredIds = [...collaboratorUserIds].filter(id => id === viewerUserId);
        if (filteredIds.length === 0) {
          // Show all collabs if viewer isn't a collaborator (public view)
        }
      }

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .in('user_id', [...collaboratorUserIds]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build collaborations list
      const result: Collaboration[] = [];

      for (const project of projects) {
        // Get collaborators for this project
        const projectCollabs = allCollaborators?.filter(c => c.project_id === project.id) || [];
        
        // Add project creator if they're not the profile user
        if (project.created_by !== userId) {
          const profile = profileMap.get(project.created_by);
          if (profile) {
            result.push({
              project_id: project.id,
              project_title: project.title,
              project_status: project.status,
              role: collabRecords?.find(c => c.project_id === project.id)?.role || 'Collaborator',
              started_at: project.created_at,
              collaborator_id: project.created_by,
              collaborator_name: profile.full_name,
              collaborator_avatar: profile.avatar_url || '',
              collaborator_role: profile.role || '',
            });
          }
        }

        // Add other collaborators
        for (const collab of projectCollabs) {
          const profile = profileMap.get(collab.user_id);
          if (profile) {
            result.push({
              project_id: project.id,
              project_title: project.title,
              project_status: project.status,
              role: collab.role || 'Collaborator',
              started_at: collab.created_at,
              collaborator_id: collab.user_id,
              collaborator_name: profile.full_name,
              collaborator_avatar: profile.avatar_url || '',
              collaborator_role: profile.role || '',
            });
          }
        }
      }

      // Deduplicate by project+collaborator
      const seen = new Set<string>();
      const deduped = result.filter(c => {
        const key = `${c.project_id}-${c.collaborator_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by date descending
      deduped.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      setCollabs(deduped);
    } catch (err) {
      console.error('Error fetching collaborations:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (collabs.length === 0) {
    return (
      <div className="text-center py-8">
        <Handshake className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          {isOwnProfile 
            ? 'No collaborations yet. Start a project with someone from Circle!' 
            : 'No collaboration history to show.'}
        </p>
      </div>
    );
  }

  // Group by project
  const projectGroups = new Map<string, { title: string; status: string; date: string; collaborators: Collaboration[] }>();
  for (const c of collabs) {
    if (!projectGroups.has(c.project_id)) {
      projectGroups.set(c.project_id, {
        title: c.project_title,
        status: c.project_status,
        date: c.started_at,
        collaborators: [],
      });
    }
    projectGroups.get(c.project_id)!.collaborators.push(c);
  }

  const statusColors: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-600 border-green-500/20',
    active: 'bg-primary/10 text-primary border-primary/20',
    planning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    archived: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-3">
      {[...projectGroups.entries()].map(([projectId, group]) => (
        <Card 
          key={projectId} 
          className="hover:shadow-md transition-shadow cursor-pointer border-border/50"
          onClick={() => navigate(`/projects/${projectId}`)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-sm truncate">{group.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(group.date), 'MMM yyyy')}
                  </span>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`text-[10px] capitalize shrink-0 ${statusColors[group.status] || ''}`}
              >
                {group.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex -space-x-2">
                {group.collaborators.slice(0, 5).map((c) => (
                  <Avatar 
                    key={c.collaborator_id} 
                    className="h-7 w-7 border-2 border-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${c.collaborator_id}`);
                    }}
                  >
                    <AvatarImage src={c.collaborator_avatar} />
                    <AvatarFallback className="text-[10px]">
                      {c.collaborator_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {group.collaborators.length > 5 && (
                  <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">
                      +{group.collaborators.length - 5}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground ml-1">
                {group.collaborators.map(c => c.collaborator_name.split(' ')[0]).slice(0, 3).join(', ')}
                {group.collaborators.length > 3 && ` +${group.collaborators.length - 3}`}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
