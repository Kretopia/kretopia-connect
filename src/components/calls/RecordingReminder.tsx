import { Save, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordingReminderProps {
  visible: boolean;
  onStop: () => void;
  onSave: () => void;
  segment: "processing" | "saved" | "failed" | null;
}

export function RecordingReminder({ visible, onStop, onSave, segment }: RecordingReminderProps) {
  if (!visible && !segment) return null;
  return (
    <aside className="absolute bottom-3 inset-x-3 z-30 pointer-events-none flex justify-center">
      <div className="pointer-events-auto w-full max-w-sm rounded-lg border border-border bg-background text-foreground p-3 shadow-lg">
        {visible && <>
          <p role="status" className="text-sm font-medium mb-3">Do you want to stop or save this recording?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" className="h-11 px-2" onClick={onStop}><Square />Stop recording</Button>
            <Button className="h-11 px-2" onClick={onSave}><Save />Save recording</Button>
          </div>
        </>}
        {segment && <p role="status" className="text-xs mt-1">{segment === "processing" ? "Segment processing" : segment === "saved" ? "Segment saved · Replay available in Recordings" : "Segment save not confirmed · Retry sync in Recordings"}</p>}
      </div>
    </aside>
  );
}
