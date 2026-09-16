import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusAvatar } from "@/components/ui/status-avatar";
import { type StatusTier } from "@/lib/statusEngine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, Check, X, MessageCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface MessageRequest {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
  sender_avatar: string;
  sender_role: string;
}

interface MessageRequestsProps {
  currentUserId: string;
  onAccept: (senderId: string) => void;
  onSelectConversation: (userId: string) => void;
}

export const MessageRequests = ({ 
  currentUserId, 
  onAccept, 
  onSelectConversation 
}: MessageRequestsProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessageRequests();
  }, [currentUserId]);

  const fetchMessageRequests = async () => {
    if (!currentUserId) return;
    
    try {
      // Get all messages received
      const { data: allMessages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          content,
          created_at
        `)
        .eq('receiver_id', currentUserId)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Get connected user IDs
      const { data: connections } = await supabase
        .from('connections')
        .select('user_id, connected_user_id')
        .or(`user_id.eq.${currentUserId},connected_user_id.eq.${currentUserId}`)
        .eq('status', 'accepted');

      const connectedIds = new Set<string>();
      connections?.forEach(c => {
        if (c.user_id === currentUserId) connectedIds.add(c.connected_user_id);
        else connectedIds.add(c.user_id);
      });

      // Filter to only messages from non-connected users
      const messages = allMessages?.filter(m => !connectedIds.has(m.sender_id)) || [];

      // Get unique sender IDs
      const senderIds = [...new Set(messages?.map(m => m.sender_id) || [])];
      
      if (senderIds.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Fetch sender profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get only the latest message from each sender
      const latestMessages = new Map<string, any>();
      messages?.forEach(msg => {
        if (!latestMessages.has(msg.sender_id)) {
          latestMessages.set(msg.sender_id, msg);
        }
      });

      const requestList: MessageRequest[] = Array.from(latestMessages.values()).map(msg => {
        const profile = profileMap.get(msg.sender_id);
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          sender_name: profile?.full_name || 'Unknown',
          sender_avatar: profile?.avatar_url || '',
          sender_role: profile?.role || 'Creator'
        };
      });

      setRequests(requestList);
    } catch (error) {
      console.error('Error fetching message requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (senderId: string) => {
    try {
      // Create bidirectional connection (auto-accept when replying)
      await supabase.rpc('create_bidirectional_connection', {
        user1_uuid: currentUserId,
        user2_uuid: senderId,
        connection_status: 'accepted'
      });

      // Create bidirectional connection (auto-accept when replying)
      await supabase.rpc('create_bidirectional_connection', {
        user1_uuid: currentUserId,
        user2_uuid: senderId,
        connection_status: 'accepted'
      });

      toast({
        title: "Message accepted",
        description: "Conversation moved to your inbox",
      });

      onAccept(senderId);
      onSelectConversation(senderId);
      fetchMessageRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept message",
        variant: "destructive",
      });
    }
  };

  const handleDecline = async (senderId: string) => {
    try {
      // Delete message requests from this sender
      await supabase
        .from('messages')
        .delete()
        .eq('sender_id', senderId)
        .eq('receiver_id', currentUserId)
        .eq('is_message_request', true);

      toast({
        title: "Request declined",
        description: "The sender won't be notified",
      });

      fetchMessageRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to decline request",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No message requests</p>
        <p className="text-sm">When someone new messages you, it'll appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 p-1">
        {requests.map((request) => (
          <Card key={request.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <StatusAvatar
                  src={request.sender_avatar}
                  fallback={request.sender_name?.charAt(0) || 'U'}
                  size="lg"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate">{request.sender_name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {request.sender_role}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {request.content}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDecline(request.sender_id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="gradient"
                        onClick={() => handleAccept(request.sender_id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};
