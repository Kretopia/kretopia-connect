import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Users, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface GraphNode {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  type: 'person' | 'project';
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

interface CreditGraphProps {
  userId: string;
  userName: string;
  avatarUrl?: string;
}

export const CreditGraph = ({ userId, userName, avatarUrl }: CreditGraphProps) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGraph();
  }, [userId]);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      // Fetch user's credits
      const { data: credits } = await supabase
        .from('credits')
        .select('id, project_name, role, collaborator_user_ids, year')
        .eq('user_id', userId)
        .limit(20);

      // Fetch ICDB claimed roles
      const { data: claimedRoles } = await supabase
        .from('icdb_project_roles')
        .select('id, role_title, person_name, project_id, icdb_projects(title)')
        .eq('claimed_by', userId)
        .limit(20);

      const graphNodes: GraphNode[] = [];
      const graphEdges: GraphEdge[] = [];
      const seenProjects = new Set<string>();
      const seenPeople = new Set<string>();

      // Center node = current user
      graphNodes.push({
        id: userId,
        name: userName,
        avatar: avatarUrl,
        type: 'person',
        x: 50,
        y: 50,
      });
      seenPeople.add(userId);

      // Add projects from credits
      const allProjects = [
        ...(credits || []).map(c => ({ name: c.project_name, role: c.role, collabs: c.collaborator_user_ids })),
        ...(claimedRoles || []).map(r => ({ name: (r as any).icdb_projects?.title || 'Unknown', role: r.role_title, collabs: [] })),
      ];

      const angleStep = (2 * Math.PI) / Math.max(allProjects.length, 1);
      const projectRadius = 30;

      allProjects.forEach((proj, i) => {
        if (seenProjects.has(proj.name)) return;
        seenProjects.add(proj.name);

        const angle = angleStep * i - Math.PI / 2;
        const px = 50 + projectRadius * Math.cos(angle);
        const py = 50 + projectRadius * Math.sin(angle);

        const nodeId = `proj-${i}`;
        graphNodes.push({
          id: nodeId,
          name: proj.name,
          role: proj.role,
          type: 'project',
          x: px,
          y: py,
        });

        graphEdges.push({
          from: userId,
          to: nodeId,
          label: proj.role,
        });
      });

      // Fetch collaborators who share projects
      if (credits && credits.length > 0) {
        const projectNames = credits.map(c => c.project_name);
        const { data: sharedCredits } = await supabase
          .from('credits')
          .select('user_id, project_name, role')
          .in('project_name', projectNames)
          .neq('user_id', userId)
          .limit(30);

        if (sharedCredits) {
          const { data: collabProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, role')
            .in('user_id', [...new Set(sharedCredits.map(c => c.user_id))]);

          const profileMap = new Map(collabProfiles?.map(p => [p.user_id, p]) || []);

          sharedCredits.forEach((sc, i) => {
            if (seenPeople.has(sc.user_id)) return;
            seenPeople.add(sc.user_id);

            const profile = profileMap.get(sc.user_id);
            const angle = (Math.PI * 2 / Math.max(sharedCredits.length, 1)) * i;
            const outerR = 42;

            graphNodes.push({
              id: sc.user_id,
              name: profile?.full_name || 'Unknown',
              avatar: profile?.avatar_url || undefined,
              role: sc.role,
              type: 'person',
              x: 50 + outerR * Math.cos(angle),
              y: 50 + outerR * Math.sin(angle),
            });

            // Connect to shared project
            const projIdx = allProjects.findIndex(p => p.name === sc.project_name);
            if (projIdx >= 0) {
              graphEdges.push({
                from: sc.user_id,
                to: `proj-${projIdx}`,
                label: sc.role,
              });
            }
          });
        }
      }

      setNodes(graphNodes);
      setEdges(graphEdges);
    } catch (err) {
      console.error('Graph fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Credit Graph
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {nodes.filter(n => n.type === 'person').length} people · {nodes.filter(n => n.type === 'project').length} projects
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 mb-2 justify-end">
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
        </div>

        <div className="relative w-full aspect-square rounded-xl bg-muted/20 border overflow-hidden">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          >
            {/* Edges */}
            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              return (
                <line
                  key={i}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke="hsl(var(--primary) / 0.2)"
                  strokeWidth="0.3"
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => (
              <g key={node.id} className="cursor-pointer">
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.id === userId ? 4 : node.type === 'project' ? 3 : 2.5}
                  fill={node.type === 'project' ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--primary) / 0.3)'}
                  stroke={node.id === userId ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)'}
                  strokeWidth={node.id === userId ? 0.5 : 0.3}
                />
                <text
                  x={node.x}
                  y={node.y + (node.id === userId ? 6 : 5)}
                  textAnchor="middle"
                  fontSize={node.id === userId ? 2.2 : 1.8}
                  fill="hsl(var(--foreground))"
                  className="select-none"
                >
                  {node.name.length > 15 ? node.name.slice(0, 15) + '…' : node.name}
                </text>
                {node.type === 'project' && (
                  <text
                    x={node.x}
                    y={node.y + (node.id === userId ? 8 : 7)}
                    textAnchor="middle"
                    fontSize={1.4}
                    fill="hsl(var(--muted-foreground))"
                    className="select-none"
                  >
                    {node.role || ''}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Collaboration network based on shared project credits
        </p>
      </CardContent>
    </Card>
  );
};
