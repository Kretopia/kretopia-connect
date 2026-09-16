import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileSignature, Plus, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ContractDisclaimer } from "@/components/legal/ContractDisclaimer";
import type { Json } from "@/integrations/supabase/types";

interface ContractBuilderProps {
  projectId: string;
  currentUserId: string;
  collaborators: any[];
  onBack: () => void;
}

interface Section {
  title: string;
  content: string;
}

const CONTRACT_TYPES = [
  { value: "service_agreement", label: "Service Agreement" },
  { value: "nda", label: "Non-Disclosure Agreement" },
  { value: "work_for_hire", label: "Work for Hire" },
  { value: "collaboration", label: "Collaboration Agreement" },
  { value: "custom", label: "Custom" },
];

export function ContractBuilder({ projectId, currentUserId, collaborators, onBack }: ContractBuilderProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contractType, setContractType] = useState("service_agreement");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [partyBUserId, setPartyBUserId] = useState("");
  const [sections, setSections] = useState<Section[]>([
    { title: "Scope of Work", content: "" },
    { title: "Deliverables", content: "" },
    { title: "Payment Terms", content: "" },
    { title: "Timeline", content: "" },
  ]);

  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("is_public", true)
        .order("usage_count", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const terms: Json = { sections: sections.map(s => ({ title: s.title, content: s.content })) };
      const { error } = await supabase.from("project_contracts").insert({
        project_id: projectId,
        created_by: currentUserId,
        template_id: selectedTemplateId,
        title,
        description,
        contract_type: contractType,
        terms,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
        currency,
        party_a_user_id: currentUserId,
        party_b_user_id: partyBUserId || null,
        status: partyBUserId ? "pending_signature" : "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contract created", description: "Your contract has been created successfully." });
      import("@/lib/analytics").then(({ analytics }) => {
        analytics.featureUsed("contract_created", { project_id: projectId, contract_type: contractType });
      });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setTitle(template.title);
    setDescription(template.description || "");
    setContractType(template.contract_type);
    const tmpl = template.terms_template as any;
    if (tmpl?.sections) {
      setSections(tmpl.sections.map((s: any) => ({ title: s.title || "", content: s.content || "" })));
    }
    setStep(2);
  };

  const addSection = () => setSections([...sections, { title: "", content: "" }]);
  const removeSection = (i: number) => setSections(sections.filter((_, idx) => idx !== i));
  const updateSection = (i: number, field: keyof Section, value: string) => {
    const updated = [...sections];
    updated[i] = { ...updated[i], [field]: value };
    setSections(updated);
  };

  const otherCollaborators = collaborators.filter(c => c.user_id !== currentUserId);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Contracts
      </Button>

      <div className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">New Contract</h2>
      </div>

      <ContractDisclaimer variant="banner" />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {["Template", "Details", "Terms", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <button
              onClick={() => i + 1 < step && setStep(i + 1)}
              className={`px-2 py-1 rounded-full font-medium transition-colors ${
                step === i + 1 ? "bg-primary text-primary-foreground" :
                step > i + 1 ? "bg-primary/20 text-primary cursor-pointer" :
                "bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
            {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Start from a template or create a custom contract.</p>
          <div className="grid gap-2">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="btn-glass btn-glass-outline p-3 rounded-xl text-left"
              >
                <p className="font-medium text-sm">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setStep(2)} className="w-full gap-1.5">
            <Plus className="h-4 w-4" /> Start from Scratch
          </Button>
        </div>
      )}

      {/* Step 2: Contract Details */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contract Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Music Video Production Agreement" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this contract..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="TTD">TTD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Total Amount</Label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Other Party</Label>
            {otherCollaborators.length > 0 ? (
              <Select value={partyBUserId} onValueChange={setPartyBUserId}>
                <SelectTrigger><SelectValue placeholder="Select collaborator..." /></SelectTrigger>
                <SelectContent>
                  {otherCollaborators.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.display_name || "Collaborator"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-lg">
                Add collaborators to this project first to assign the other party.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!title} className="flex-1">
              Next: Terms <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Terms / Sections */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Define the terms of your contract. Add, edit, or remove sections.</p>
          {sections.map((section, i) => (
            <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={section.title}
                  onChange={e => updateSection(i, "title", e.target.value)}
                  placeholder="Section title"
                  className="font-medium"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeSection(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={section.content}
                onChange={e => updateSection(i, "content", e.target.value)}
                placeholder="Enter the terms for this section..."
                rows={3}
              />
            </div>
          ))}
          <Button variant="outline" onClick={addSection} className="w-full gap-1.5" size="sm">
            <Plus className="h-4 w-4" /> Add Section
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)} className="flex-1">
              Next: Review <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h3 className="font-bold text-base">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{CONTRACT_TYPES.find(t => t.value === contractType)?.label}</span>
              {totalAmount && <span>• {currency} {Number(totalAmount).toLocaleString()}</span>}
            </div>
            <hr className="border-border" />
            {sections.filter(s => s.title || s.content).map((s, i) => (
              <div key={i}>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content || "—"}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? "Creating..." : "Create Contract"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
