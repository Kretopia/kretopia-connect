import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";

interface AddCreditSectionProps {
  project: {
    id: string;
    title: string;
    status?: string | null;
    workspace_type?: string | null;
  };
  collaborators: Array<{ id: string; full_name: string }>;
}

export const AddCreditSection = ({ project, collaborators }: AddCreditSectionProps) => {
  const navigate = useNavigate();

  // Used to return null here — inside the "Add a credit" disclosure that
  // now collapses this by default, a null render looked like a broken,
  // empty expand instead of an explained one.
  if (project.status !== "completed") {
    return (
      <section className="px-4 py-5">
        <div className="rounded-2xl border border-dashed border-border/60 p-4 text-center space-y-1.5">
          <Award className="h-5 w-5 mx-auto text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">No credit yet</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Credits unlock once "{project.title}" is wrapped — collaborators get tagged
            automatically when you add it.
          </p>
        </div>
      </section>
    );
  }

  const handleAdd = () => {
    const tagged = collaborators.map((c) => c.id).join(",");
    const params = new URLSearchParams({
      project_id: project.id,
      title: project.title,
      ...(tagged && { collaborators: tagged }),
    });
    navigate(`/credits/new?${params.toString()}`);
  };

  return (
    <section className="px-4 py-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--energy)/0.18)] via-primary/8 to-transparent ring-1 ring-[hsl(var(--energy)/0.35)] p-5 text-center space-y-3">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-[hsl(var(--energy)/0.4)] blur-3xl opacity-60"
        />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
          Wrap it up
        </p>
        <div className="relative h-12 w-12 rounded-2xl bg-[hsl(var(--energy)/0.2)] ring-1 ring-[hsl(var(--energy)/0.4)] flex items-center justify-center mx-auto shadow-[0_0_16px_hsl(var(--energy)/0.4)]">
          <Award className="h-6 w-6 text-[hsl(var(--energy))]" />
        </div>
        <div className="relative">
          <p className="text-base font-black tracking-tight">This project is complete.</p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            Add it to your verified credits — collaborators get tagged automatically.
          </p>
        </div>
        <Button
          onClick={handleAdd}
          className="relative w-full bg-[hsl(var(--energy))] text-[hsl(var(--background))] hover:bg-[hsl(var(--energy)/0.9)] font-bold shadow-[0_0_16px_hsl(var(--energy)/0.4)]"
        >
          Add Credit
        </Button>
      </div>
    </section>
  );
};
