import { useRef, useState } from "react";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IMPORT_PROVIDERS, type ProviderId } from "@/lib/studioImport";

interface Props {
  provider: ProviderId;
  connected: boolean;
  busy: boolean;
  uploadName: string | null;
  onConnect: () => void;
  onFile: (file: File) => void;
}

const MAX = { slack_export: 200, csv: 15 } as const;

export const ConnectStep = ({ provider, connected, busy, uploadName, onConnect, onFile }: Props) => {
  const meta = IMPORT_PROVIDERS.find((p) => p.id === provider)!;
  const inputRef = useRef<HTMLInputElement>(null);
  const [authorised, setAuthorised] = useState(false);

  if (meta.auth === "oauth") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You'll approve exactly which {meta.name} content Kretopia can read. We only ever read — nothing is
          written back to {meta.name}.
        </p>
        <Button onClick={onConnect} disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {connected ? `Reconnect ${meta.name}` : `Connect ${meta.name}`}
        </Button>
        {connected && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> {meta.name} is connected. You can revoke access any time.
          </p>
        )}
      </div>
    );
  }

  const isSlack = provider === "slack_export";
  const limit = MAX[provider as keyof typeof MAX] ?? 15;

  return (
    <div className="space-y-4">
      {isSlack && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border bg-card p-4">
          <Checkbox checked={authorised} onCheckedChange={(v) => setAuthorised(!!v)} className="mt-0.5" />
          <span className="text-xs text-muted-foreground">
            I'm authorised to bring this Slack export into Kretopia, and I understand it will be stored as a
            read-only archive inside this Studio only.
          </span>
        </label>
      )}

      <button
        type="button"
        disabled={busy || (isSlack && !authorised)}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-8 text-center transition-colors hover:border-primary/60 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
        <span className="text-sm font-semibold">{uploadName ?? `Choose your ${isSlack ? "Slack export .zip" : ".csv file"}`}</span>
        <span className="text-xs text-muted-foreground">Up to {limit}MB · stays private to you</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={meta.accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {isSlack && (
        <p className="text-xs text-muted-foreground">
          In Slack: Settings &amp; administration → Workspace settings → Import/Export data → Export.
        </p>
      )}
    </div>
  );
};
