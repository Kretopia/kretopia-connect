import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Paperclip, FileText, X } from "lucide-react";

interface Message {
  id: string;
  message: string;
  created_at: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface MessagePanelProps {
  messages: Message[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  attachedFile: File | null;
  setAttachedFile: (file: File | null) => void;
  sendingMessage: boolean;
  onSendMessage: () => void;
  onFileAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  compact?: boolean;
}

export function MessagePanel({
  messages,
  newMessage,
  setNewMessage,
  attachedFile,
  setAttachedFile,
  sendingMessage,
  onSendMessage,
  onFileAttach,
  messagesEndRef,
  compact = false,
}: MessagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const isImageFile = (fileType: string) => {
    return fileType?.startsWith('image/');
  };

  if (compact) {
    return (
      <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 px-4">
          <div className="py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2.5">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={msg.profiles?.avatar_url} />
                  <AvatarFallback className="text-xs">{msg.profiles?.full_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-xs">{msg.profiles?.full_name || 'User'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  {msg.file_url && (
                    <div className="mt-2">
                      {isImageFile(msg.file_type || '') ? (
                        <div className="rounded-lg overflow-hidden border max-w-sm">
                          <img src={msg.file_url} alt={msg.file_name} className="w-full h-auto" />
                        </div>
                      ) : (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors text-xs max-w-xs">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{msg.file_name}</p>
                            {msg.file_size && <p className="text-xs text-muted-foreground">{formatFileSize(msg.file_size)}</p>}
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="border-t p-3 bg-background">
          {attachedFile && (
            <div className="mb-2 p-2 bg-secondary rounded-lg flex items-center gap-2 text-xs">
              <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1 truncate">{attachedFile.name}</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAttachedFile(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileAttach} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
              className="flex-1 h-9 text-sm"
            />
            <Button onClick={onSendMessage} disabled={sendingMessage} size="icon" className="h-9 w-9">
              {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4">
        <div className="py-3 space-y-3 pb-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-primary/10">
                <AvatarImage src={msg.profiles?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                  {msg.profiles?.full_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-semibold text-sm truncate">{msg.profiles?.full_name || 'User'}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bg-secondary/50 rounded-2xl rounded-tl-none p-3">
                  <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                  {msg.file_url && (
                    <div className="mt-2">
                      {isImageFile(msg.file_type || '') ? (
                        <img src={msg.file_url} alt={msg.file_name} className="rounded-lg max-w-full h-auto border border-border" />
                      ) : (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" 
                           className="flex items-center gap-2 p-2.5 bg-background rounded-lg text-sm active:bg-muted border border-border">
                          <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                          <span className="truncate text-xs">{msg.file_name}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-3 bg-background shadow-lg">
        {attachedFile && (
          <div className="mb-2 p-2.5 bg-primary/5 rounded-xl flex items-center gap-2 text-sm border border-primary/20">
            <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <span className="flex-1 truncate font-medium text-xs">{attachedFile.name}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 text-xs p-0" onClick={() => setAttachedFile(null)}>✕</Button>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={onFileAttach} />
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
            className="flex-1 h-10 text-sm rounded-xl"
          />
          <Button onClick={onSendMessage} disabled={sendingMessage} size="icon" className="h-10 w-10 rounded-xl flex-shrink-0">
            {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
