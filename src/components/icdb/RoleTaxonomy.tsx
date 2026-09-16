import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Tag, Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TaxonomyEntry {
  id: string;
  code: string;
  title: string;
  department: string;
  industry: string;
  aliases: string[];
  description: string | null;
}

interface RoleTaxonomyProps {
  onSelect?: (role: TaxonomyEntry) => void;
  selectedIndustry?: string;
}

const INDUSTRY_LABELS: Record<string, string> = {
  film_tv: 'Film & TV',
  music: 'Music',
  fashion: 'Fashion & Beauty',
  performing: 'Performing Arts',
  events: 'Events & Live',
  digital: 'Digital & Content',
  art: 'Art & Design',
};

const INDUSTRY_COLORS: Record<string, string> = {
  film_tv: 'bg-primary/10 text-primary border-primary/20',
  music: 'bg-primary/10 text-primary border-primary/20',
  fashion: 'bg-primary/10 text-primary border-primary/20',
  performing: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  events: 'bg-green-500/10 text-green-600 border-green-500/20',
  digital: 'bg-primary/10 text-primary border-primary/20',
  art: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

export const RoleTaxonomy = ({ onSelect, selectedIndustry }: RoleTaxonomyProps) => {
  const [roles, setRoles] = useState<TaxonomyEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, [selectedIndustry]);

  const fetchRoles = async () => {
    setLoading(true);
    let query = supabase.from('icdb_role_taxonomy').select('*').order('industry').order('department').order('title');
    if (selectedIndustry) query = query.eq('industry', selectedIndustry);
    const { data } = await query;
    setRoles((data || []) as TaxonomyEntry[]);
    setLoading(false);
  };

  const filtered = roles.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) ||
           r.code.toLowerCase().includes(q) ||
           r.department.toLowerCase().includes(q) ||
           (r.aliases || []).some(a => a.toLowerCase().includes(q));
  });

  const grouped = filtered.reduce<Record<string, TaxonomyEntry[]>>((acc, role) => {
    const key = role.industry;
    if (!acc[key]) acc[key] = [];
    acc[key].push(role);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Role Taxonomy
          <Badge variant="secondary" className="text-[10px] ml-auto">{roles.length} roles</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search roles, departments, codes..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-4">
              {Object.entries(grouped).map(([industry, industryRoles]) => (
                <div key={industry}>
                  <Badge variant="outline" className={`text-[10px] mb-2 ${INDUSTRY_COLORS[industry] || ''}`}>
                    {INDUSTRY_LABELS[industry] || industry}
                  </Badge>
                  <div className="space-y-1">
                    {industryRoles.map(role => (
                      <div
                        key={role.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => onSelect?.(role)}
                      >
                        <code className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded text-primary shrink-0">
                          {role.code}
                        </code>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{role.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {role.department} · {(role.aliases || []).slice(0, 3).join(', ')}
                          </p>
                        </div>
                        <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
