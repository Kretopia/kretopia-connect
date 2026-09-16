import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useClient, useClientProjects, useClientContacts } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Plus, Mail, Phone, Globe, FolderKanban, Users, FileText, Send, Loader2 } from "lucide-react";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { StudioCardsGrid } from "@/components/project/studio/StudioCardsGrid";
import { GuestStudioShareDialog } from "@/components/project/GuestStudioShareDialog";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: client, isLoading } = useClient(clientId);
  const { data: projects = [] } = useClientProjects(clientId);
  const { data: contacts = [] } = useClientContacts(clientId);
  const [editing, setEditing] = useState(false);
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [emailingProjectId, setEmailingProjectId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const sendStudioLinkEmail = async (projectId: string, projectTitle: string) => {
    if (!client?.contact_email) {
      toast({ title: "No client email on file", description: "Add an email to this client first.", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();

      // Pre-create a pending client collaborator row so when they magic-link in, they auto-accept as client.
      await supabase.from("project_collaborators").insert({
        project_id: projectId,
        email: client.contact_email.toLowerCase(),
        invited_by: user.id,
        role: "member",
        agent_role: "client",
        status: "pending",
      }).select().maybeSingle();

      const { error } = await supabase.functions.invoke("send-project-invitation", {
        body: {
          email: client.contact_email,
          projectTitle,
          projectId,
          inviterName: profile?.full_name || "Your collaborator",
        },
      });
      if (error) throw error;
      toast({ title: "Studio link sent", description: `Emailed ${client.contact_email}.` });
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
      setEmailingProjectId(null);
    }
  };


  if (isLoading) return <div className="p-4">Loading…</div>;
  if (!client) return <div className="p-4">Client not found.</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6 pb-32">
      <SEO title={`${client.company_name || client.name} · Client`} description="Client hub" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/clients")}
        className="h-8 px-2 -ml-2 text-xs gap-1 text-muted-foreground hover:text-[hsl(var(--energy))] mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Button>

      <div className="space-y-3">
        <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
          Client
        </p>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--energy)/0.12)] text-[hsl(var(--energy))] flex items-center justify-center font-black text-2xl shrink-0">
              {(client.company_name || client.name).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05] truncate">{client.company_name || client.name}</h1>
              {client.company_name && <p className="text-sm text-muted-foreground truncate mt-1">{client.name}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>

        {/* Contact strip */}
        {(client.contact_email || client.contact_phone || client.website) && (
          <div className="flex flex-wrap items-center gap-2">
            {client.contact_email && (
              <a href={`mailto:${client.contact_email}`} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-card/80 border border-border px-2 py-1 backdrop-blur-sm">
                <Mail className="h-3 w-3" /> {client.contact_email}
              </a>
            )}
            {client.contact_phone && (
              <a href={`tel:${client.contact_phone}`} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-card/80 border border-border px-2 py-1 backdrop-blur-sm">
                <Phone className="h-3 w-3" /> {client.contact_phone}
              </a>
            )}
            {client.website && (
              <a href={client.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs rounded-full bg-card/80 border border-border px-2 py-1 backdrop-blur-sm">
                <Globe className="h-3 w-3" /> Site
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 mb-6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Projects */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" /> Projects ({projects.length})
          </h2>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/desk?client=${client.id}`)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Studio
          </Button>
        </div>

        {projects.length > 0 ? (
          <div className="space-y-2">
            {(projects as any[]).map((p) => (
              <div key={p.id} className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/desk/${p.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold truncate">{p.title || "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{p.status || "active"}</p>
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => { setEmailingProjectId(p.id); sendStudioLinkEmail(p.id, p.title || "Project"); }}
                  disabled={sendingEmail || !client.contact_email}
                  title={!client.contact_email ? "Add a client email first" : "Email client a one-tap Studio link"}
                >
                  {sendingEmail && emailingProjectId === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Email link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShareProjectId(p.id)}>
                  Share
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <StudioCardsGrid
            projects={projects as any}
            onNewProject={() => navigate(`/desk?client=${client.id}`)}
          />
        )}
      </section>

      {shareProjectId && (
        <GuestStudioShareDialog
          open={!!shareProjectId}
          onOpenChange={(o) => !o && setShareProjectId(null)}
          projectId={shareProjectId}
          projectTitle={(projects as any[]).find((p) => p.id === shareProjectId)?.title}
        />
      )}

      {/* Contacts */}
      <section className="mb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> People ({contacts.length})
        </h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/60 p-4 text-center">
            Add team members or stakeholders from this client. Coming soon.
          </p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-border/60 bg-card p-3">
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.role} · {c.email}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      {client.notes && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Notes
          </h2>
          <div className="rounded-xl border border-border/60 bg-card p-3 text-sm whitespace-pre-wrap">{client.notes}</div>
        </section>
      )}

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} />
    </div>
  );
};

export default ClientDetail;
