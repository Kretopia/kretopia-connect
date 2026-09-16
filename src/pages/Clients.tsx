import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClients, type Client } from "@/hooks/useClients";
import { AIAddClientCard } from "@/components/clients/AIAddClientCard";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Mail, Phone, ChevronRight, UserPlus, FolderKanban, ClipboardList } from "lucide-react";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { SEO } from "@/components/SEO";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoTip } from "@/components/agent/KretoTip";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";

const CLIENTS_TUTORIAL: TutorialStep[] = [
  { icon: UserPlus, title: "Add a client", body: "Save their name, company, and contact details in one place — takes a few seconds." },
  { icon: FolderKanban, title: "See everything in one hub", body: "Every project and thread tied to this client shows up together, not scattered across your Studios." },
  { icon: ClipboardList, title: "Keep terms on file", body: "Save their default markup and payment terms here so you're not digging through old messages to find them again." },
];

const Clients = () => {
  const { data: clients = [], isLoading } = useClients();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Partial<Client> | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const navigate = useNavigate();

  return (
    <div className="pb-32">
      <SEO title="Clients · Kretopia" description="All your clients in one hub" />

      <FeaturePageHeader
        eyebrow="Client hub"
        title="Clients."
        accentTitle="Everyone you work with."
        subtitle="Group projects, contacts and threads under one client — no more digging for who's who."
        tutorial={{ featureKey: "clients", label: "How Clients works", steps: CLIENTS_TUTORIAL }}
      />

      <div className="max-w-3xl mx-auto p-4">
        <KretoTip compact className="mb-4" />
        <AIAddClientCard
          onDraft={(d) => {
            setDraft(d);
            setDraftKey((k) => k + 1);
            setShowForm(true);
          }}
        />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-bold">No clients yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Add a client to group all their projects, briefs and invoices in one place.
          </p>
          <Button onClick={() => { setDraft(null); setDraftKey((k) => k + 1); setShowForm(true); }} size="sm" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Add your first client
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/clients/${c.id}`)}
              className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card hover:border-[hsl(var(--energy)/0.35)] transition-colors p-3 text-left"
            >
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--energy)/0.12)] text-[hsl(var(--energy))] flex items-center justify-center font-bold shrink-0">
                {(c.company_name || c.name).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.company_name || c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.company_name ? c.name : c.contact_email || "No contact email"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      </div>

      <ClientFormDialog key={draftKey} open={showForm} onOpenChange={setShowForm} client={draft as Client | null} />
    </div>
  );
};

export default Clients;
