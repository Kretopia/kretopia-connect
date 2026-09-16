import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, Plus, Check, ChevronDown } from "lucide-react";
import { useClients, useLinkProjectToClient } from "@/hooks/useClients";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Props {
  projectId: string;
  currentClientId?: string | null;
  fallbackName?: string | null;
}

/**
 * Inline client chip that lets the project owner attach the project to a Client record.
 * Solves the "Elisa sent multiple briefs" case — group all under one client.
 */
export const ProjectClientChip = ({ projectId, currentClientId, fallbackName }: Props) => {
  const { data: clients = [] } = useClients();
  const link = useLinkProjectToClient();
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { toast } = useToast();

  const current = clients.find((c) => c.id === currentClientId);
  const label = current ? (current.company_name || current.name) : (fallbackName || "Link to client");

  const choose = async (clientId: string | null) => {
    try {
      await link.mutateAsync({ projectId, clientId });
      toast({ title: clientId ? "Linked to client" : "Unlinked" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Couldn't link", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground rounded-full px-2 py-1 hover:bg-accent/40 transition-colors max-w-full"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {current ? "For " : ""}
              <span className={current ? "text-foreground font-semibold" : ""}>{label}</span>
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b border-border">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Client</p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {clients.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No clients yet.</p>
            )}
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent/40"
              >
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                  {(c.company_name || c.name).charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate">{c.company_name || c.name}</span>
                {c.id === currentClientId && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1.5 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => { setOpen(false); setShowNew(true); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent/40"
            >
              <Plus className="h-3.5 w-3.5" /> New client
            </button>
            {currentClientId && (
              <>
                <Link
                  to={`/clients/${currentClientId}`}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent/40"
                  onClick={() => setOpen(false)}
                >
                  <Building2 className="h-3.5 w-3.5" /> Open client hub
                </Link>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Unlink from client
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ClientFormDialog
        open={showNew}
        onOpenChange={setShowNew}
        onSaved={(c) => choose(c.id)}
      />
    </>
  );
};
