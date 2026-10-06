import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { KretoAvatar } from "@/components/brand/KretoAvatar";

interface Message {
  id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

interface SupportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const SupportDialog = ({ open: controlledOpen, onOpenChange }: SupportDialogProps = {}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && !ticketId) {
      createNewTicket();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`support-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const createNewTicket = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to contact support",
          variant: "destructive",
        });
        setOpen(false);
        return;
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          title: 'New Support Request',
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      setTicketId(data.id);

      // Add initial AI greeting
      const greeting = "Hi, Kreto here. Tell me what went wrong or what you need help with. If needed, I’ll pass it to the Kretopia team.";
      
      await supabase.from('support_messages').insert({
        ticket_id: data.id,
        sender_type: 'ai',
        content: greeting,
      });

      setMessages([{
        id: crypto.randomUUID(),
        sender_type: 'ai',
        content: greeting,
        created_at: new Date().toISOString()
      }]);

    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Error",
        description: "Failed to start support session",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !ticketId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // Save user message
      await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        sender_type: 'user',
        content: userMessage,
      });

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender_type: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      }]);

      // Get AI response
      const conversationHistory = messages.map(m => ({
        role: m.sender_type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('ai-support', {
        body: { 
          ticketId, 
          message: userMessage,
          conversationHistory 
        }
      });

      if (error) throw error;

      if (data.category) {
        setCategory(data.category);
      }

      // Add AI response to messages
      if (data.message) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sender_type: 'ai',
          content: data.message,
          created_at: new Date().toISOString()
        }]);
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'bug': return 'destructive';
      case 'feature-request': return 'secondary';
      case 'question': return 'default';
      case 'feedback': return 'outline';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="relative" aria-label="Open support chat">
            <MessageCircle className="h-5 w-5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Kreto Support</DialogTitle>
            {category && (
              <Badge variant={getCategoryColor(category)}>
                {category.replace('-', ' ')}
              </Badge>
            )}
          </div>
          <DialogDescription>
            Get immediate guidance from Kreto. Complex issues will be escalated to the Kretopia team.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender_type === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender_type === 'user' 
                    ? 'bg-primary' 
                    : 'bg-secondary'
                }`}>
                  {message.sender_type === 'user' ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <KretoAvatar size="xs" animated={false} />
                  )}
                </div>
                <div
                  className={`flex-1 p-3 rounded-lg ${
                    message.sender_type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-secondary">
                  <KretoAvatar size="xs" state="thinking" />
                </div>
                <div className="flex-1 p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Kreto is checking…</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Input
            placeholder="Describe your issue..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Powered by Kretopia • Free during beta
        </p>
      </DialogContent>
    </Dialog>
  );
};