import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ConnectionRequestActionsProps {
  connectionUserId: string;
  connectionStatus: 'none' | 'pending' | 'accepted' | 'declined';
  isPendingReceived: boolean;
  onStatusChange: (newStatus: 'none' | 'pending' | 'accepted' | 'declined') => void;
  variant?: 'default' | 'compact';
}

export const ConnectionRequestActions = ({
  connectionUserId,
  connectionStatus,
  isPendingReceived,
  onStatusChange,
  variant = 'default'
}: ConnectionRequestActionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Update the pending connection to accepted
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('user_id', connectionUserId)
        .eq('connected_user_id', user.id);

      if (error) throw error;

      // Create bidirectional connection
      await supabase.rpc('create_bidirectional_connection', {
        user1_uuid: user.id,
        user2_uuid: connectionUserId,
        connection_status: 'accepted'
      });

      // Award XP to both users (server-side)
      await Promise.all([
        supabase.rpc('award_xp' as any, { p_user_id: user.id, p_amount: 20, p_reason: 'connection_accepted' }),
        supabase.rpc('award_xp' as any, { p_user_id: connectionUserId, p_amount: 20, p_reason: 'connection_accepted' })
      ]);

      onStatusChange('accepted');
      toast({
        title: "Connection Accepted! +20 XP",
        description: "You're now connected",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to accept connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Silently decline - set declined_at but don't notify the sender
      const { error } = await supabase
        .from('connections')
        .update({ 
          status: 'declined',
          declined_at: new Date().toISOString()
        })
        .eq('user_id', connectionUserId)
        .eq('connected_user_id', user.id);

      if (error) throw error;

      onStatusChange('declined');
      toast({
        title: "Request declined",
        description: "The sender won't be notified",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to decline request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in to connect",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: connectionUserId,
          status: 'pending'
        });

      if (error) throw error;

      onStatusChange('pending');
      toast({
        title: "Request sent!",
        description: "They'll be notified of your request",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Received a pending request - show Accept/Decline
  if (isPendingReceived && connectionStatus === 'pending') {
    return (
      <div className={`flex gap-2 ${variant === 'compact' ? '' : 'w-full'}`}>
        <Button
          onClick={handleAccept}
          disabled={loading}
          variant="gradient"
          size={variant === 'compact' ? 'sm' : 'default'}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-1" />
          Accept
        </Button>
        <Button
          onClick={handleDecline}
          disabled={loading}
          variant="outline"
          size={variant === 'compact' ? 'sm' : 'default'}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-1" />
          Decline
        </Button>
      </div>
    );
  }

  // Sent a pending request - show pending status
  if (connectionStatus === 'pending') {
    return (
      <Button
        disabled
        variant="outline"
        size={variant === 'compact' ? 'sm' : 'default'}
        className={variant === 'compact' ? '' : 'w-full'}
      >
        <Clock className="h-4 w-4 mr-2" />
        Request Pending
      </Button>
    );
  }

  // Already connected
  if (connectionStatus === 'accepted') {
    return null;
  }

  // Not connected - show connect button
  return (
    <Button
      onClick={handleSendRequest}
      disabled={loading}
      variant="outline"
      size={variant === 'compact' ? 'sm' : 'default'}
      className={variant === 'compact' ? '' : 'w-full'}
    >
      <UserPlus className="h-4 w-4 mr-2" />
      Connect
    </Button>
  );
};
