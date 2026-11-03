import { useId, useState, type FormEvent } from "react";
import { Video } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

interface GuestNameStepProps {
  title: string;
  hint?: string;
  /** The button's label: what happens next ("Join call"). */
  cta: string;
  /** A signed-in person arrives with their own name filled in. */
  initialName?: string;
  /** True while the room's access is being fetched. */
  busy?: boolean;
  onSubmit: (name: string) => void;
}

/**
 * The one thing a join link asks before the call itself: what to call you. The name goes into the person's Daily token, so it is what the
 * others see. After it, the call is the same one every other entry starts (camera and mic preview, then Join); this step owns no frame,
 * toolbar or controls.
 */
export function GuestNameStep({ title, hint, cta, initialName = "", busy = false, onSubmit }: GuestNameStepProps) {
  const [name, setName] = useState(initialName);
  const inputId = useId();
  const trimmed = name.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed && !busy) onSubmit(trimmed);
  };
  return (
    <main className="k-call-min-vh flex flex-col items-center justify-center bg-background px-4 py-10 text-foreground" data-testid="guest-name-step">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 text-center" aria-labelledby={`${inputId}-title`}>
        <BrandLogo size="sm" className="mx-auto" />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <Video className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 id={`${inputId}-title`} className="text-xl font-semibold">
            {title}
          </h1>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="space-y-1.5 text-left">
          <label htmlFor={inputId} className="text-sm font-medium">
            Your name
          </label>
          <Input id={inputId} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" autoFocus className="h-11 bg-secondary" />
        </div>
        <Button type="submit" disabled={!trimmed || busy} className="h-11 w-full rounded-full gap-2">
          {busy ? <KretopiaSpinner className="h-4 w-4" /> : null}
          {cta}
        </Button>
        <p className="text-[11px] text-muted-foreground">Camera and mic permission is asked on the next step.</p>
      </form>
    </main>
  );
}

export default GuestNameStep;
