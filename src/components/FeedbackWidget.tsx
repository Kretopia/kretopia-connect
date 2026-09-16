import { useState, useRef, useEffect } from "react";
import { MessageSquarePlus, Send, X, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("feedback-dismissed") === "true");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hey! I'm here to hear your thoughts on Kretopia. Got a bug to report, a feature idea, or just general feedback? Let me know!",
      }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Listen for "open-feedback" event from hamburger menu
  useEffect(() => {
    const handler = () => { setDismissed(false); setOpen(true); };
    window.addEventListener("open-feedback", handler);
    return () => window.removeEventListener("open-feedback", handler);
  }, []);

  if (!user) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const { data, error } = await supabase.functions.invoke("feedback-chat", {
        body: {
          messages: newMessages.filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({ role: m.role, content: m.content })),
          pageUrl: window.location.pathname,
        },
      });

      if (error) throw error;

      if (data?.message) {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      }
      if (data?.saved) {
        setSaved(true);
        toast({ title: "Feedback saved!", description: "Thanks for helping us improve." });
      }
      if (data?.category) {
        setCategory(data.category);
      }
    } catch (err: any) {
      const errMsg = err?.message || "Something went wrong";
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after animation
    setTimeout(() => {
      setMessages([]);
      setSaved(false);
      setCategory(null);
    }, 300);
  };

  const categoryColors: Record<string, string> = {
    bug: "bg-red-500/10 text-red-500",
    feature: "bg-primary/10 text-primary",
    ui: "bg-primary/10 text-primary",
    general: "bg-muted text-muted-foreground",
  };

  const categoryLabels: Record<string, string> = {
    bug: "Bug",
    feature: "Feature",
    ui: "UI/UX",
    general: "General",
  };

  if (!user || dismissed) return null;

  return (
    <>
      {/* FAB removed — feedback is now opened from the hamburger menu via the "open-feedback" event */}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 w-[340px] max-h-[480px] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Feedback</span>
              {category && (
                <Badge variant="secondary" className={`text-xs ${categoryColors[category] || ""}`}>
                  {categoryLabels[category] || category}
                </Badge>
              )}
            </div>
            <button onClick={handleClose} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[320px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[240px] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {saved && (
              <div className="text-center">
                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                  ✓ Feedback recorded
                </Badge>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your feedback..."
                className="text-sm h-9"
                disabled={loading}
                maxLength={1000}
              />
              <Button
                type="submit"
                size="sm"
                className="h-9 w-9 p-0"
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
