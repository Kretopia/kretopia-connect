import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search } from "lucide-react";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

export function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles and roles separately (no FK relationship)
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(PROFILE_SELECT)
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      // Map roles to users
      const rolesMap = new Map(
        (rolesRes.data || []).map((r) => [r.user_id, r.role])
      );

      const usersWithRoles = (profilesRes.data || []).map((user) => ({
        ...user,
        admin_role: rolesMap.get(user.user_id) || "user",
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: "admin" | "moderator" | "writer" | "user") => {
    try {
      // First, remove existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Then add new role if not 'user' (user is default)
      if (role !== "user") {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>XP</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-right">Admin Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const userRole = user.admin_role || "user";
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.avatar_url && !failedAvatars.has(user.id) ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          loading="lazy"
                          onError={() => setFailedAvatars((prev) => new Set(prev).add(user.id))}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs">
                            {user.full_name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.role}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {userRole === "admin" && (
                      <Badge variant="destructive">
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                    {userRole === "moderator" && (
                      <Badge variant="secondary">
                        <Shield className="mr-1 h-3 w-3" />
                        Moderator
                      </Badge>
                    )}
                    {userRole === "writer" && (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                        <Shield className="mr-1 h-3 w-3" />
                        Writer
                      </Badge>
                    )}
                    {userRole === "user" && (
                      <Badge variant="outline">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Level {user.level}</Badge>
                  </TableCell>
                  <TableCell>{user.xp}</TableCell>
                  <TableCell>
                    <Badge className="capitalize">{user.badge}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.subscription_tier || "free"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={userRole}
                      onValueChange={(value: any) =>
                        updateUserRole(user.user_id, value)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="writer">Writer</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
