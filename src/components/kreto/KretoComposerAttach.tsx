import { useRef, useState } from "react";
import { Paperclip, X, RotateCcw } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { Button } from "@/components/ui/button";
import { parseKretoAttachment, deleteKretoAttachment, openKretoAttachment, type ParsedAttachment } from "@/lib/thriveCopilot";

export interface ComposerAttachment {
  id: string;
  name: string;
  status: "parsing" | "ready" | "failed";
  /** Extracted text, present once status is "ready". */
  text?: string;
  referenceId?: string;
  expires_at?: string;
  /** User-facing failure reason, present once status is "failed". */
  error?: string;
  /** Kept only so a failed parse can be retried without re-picking the file. */
  file?: File;
}

const MAX_FILES = 3;
const ACCEPT = ".pdf,.txt,.md,.csv,image/png,image/jpeg,image/webp";

interface KretoComposerAttachProps {
  attachments: ComposerAttachment[];
  onChange: (next: ComposerAttachment[]) => void;
  disabled?: boolean;
}

/**
 * Composer attach control: PDF, image or plain-text files (max 3, 10MB each).
 * Text is extracted server-side at upload time; the raw file never travels
 * with a chat message. Each chip shows its own progress, failure and retry —
 * a failed attachment never blocks sending the text.
 */
export function KretoComposerAttach({ attachments, onChange, disabled }: KretoComposerAttachProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(attachments);
  current.current = attachments;

  const patch = (id: string, patch: Partial<ComposerAttachment>) =>
    { current.current = current.current.map((a) => (a.id === id ? { ...a, ...patch } : a)); onChange(current.current); };

  const parseOne = async (id: string, file: File) => {
    setBusy(true);
    try {
      const parsed: ParsedAttachment = await parseKretoAttachment(file);
      patch(id, { status: "ready", referenceId: parsed.id, expires_at: parsed.expires_at, text: parsed.text, error: undefined, file: undefined });
    } catch (e) {
      patch(id, { status: "failed", error: e instanceof Error ? e.message : "Could not read this file." });
    } finally {
      setBusy(false);
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_FILES - attachments.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const entries = picked.map(file => ({ id: crypto.randomUUID(), name: file.name, status: "parsing" as const, file }));
    current.current = [...current.current, ...entries];
    onChange(current.current);
    setBusy(true);
    for (const entry of entries) {
      const file = entry.file;
      await parseOne(entry.id, file);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => addFiles(e.target.files)}
      />
      <Button
        variant="ghost"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy || attachments.length >= MAX_FILES}
        className="btn-glass btn-glass-outline h-9 w-9 shrink-0 rounded-full flex items-center justify-center disabled:opacity-40"
        aria-label="Attach a file (PDF, image or text, max 3)"
        title="Attach a file (PDF, image or text, max 3)"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {attachments.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Attachments">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-2.5 py-1 text-xs max-w-[14rem]"
            >
              {a.status === "parsing" && <KretopiaSpinner className="h-3 w-3 shrink-0" />}
              {a.referenceId ? <Button variant="ghost" size="sm" className="h-auto min-w-0 truncate p-0 text-xs" title={a.error ?? a.name} onClick={() => a.referenceId && openKretoAttachment(a.referenceId).catch(e => patch(a.id, { error: e.message }))}>{a.name}</Button> : <span className="truncate" title={a.error ?? a.name}>{a.name}</span>}
              {a.status === "failed" && (
                <Button variant="ghost" size="icon"
                  type="button"
                  onClick={() => a.file && parseOne(a.id, a.file)}
                  className="shrink-0 text-foreground/60 hover:text-foreground"
                  aria-label={`Retry reading ${a.name}`}
                  title={a.error}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon"
                type="button"
                disabled={a.status === "parsing" || disabled}
                onClick={async () => {
                  try {
                    if (a.referenceId) await deleteKretoAttachment(a.referenceId);
                    current.current = current.current.filter(x => x.id !== a.id);
                    onChange(current.current);
                  } catch (e) { patch(a.id, { error: e instanceof Error ? e.message : "Delete failed." }); }
                }}
                className="shrink-0 text-foreground/50 hover:text-foreground"
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3 w-3" />
              </Button>
              {a.error && <span role="alert" className="text-destructive">{a.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default KretoComposerAttach;
