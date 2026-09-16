import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MapPin, Globe, Layers, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONLINE_FORMATS,
  type EventMode,
  type OnlineFormat,
  getFormatConfig,
} from "@/lib/eventFormats";

export interface EventFormatValue {
  event_mode: EventMode;
  online_format: OnlineFormat | null;
  online_max_attendees: number | null;
  watch_party_video_url: string;
  recording_enabled: boolean;
}

interface Props {
  value: EventFormatValue;
  onChange: (next: EventFormatValue) => void;
}

const MODE_OPTIONS: { value: EventMode; label: string; icon: typeof MapPin; helper: string }[] = [
  { value: "irl", label: "In person", icon: MapPin, helper: "At a venue" },
  { value: "online", label: "Online", icon: Globe, helper: "Video call only" },
  { value: "hybrid", label: "Hybrid", icon: Layers, helper: "Venue + livestream" },
];

export const EventModeFormatPicker = ({ value, onChange }: Props) => {
  const cfg = useMemo(() => getFormatConfig(value.online_format), [value.online_format]);
  const showOnline = value.event_mode !== "irl";

  const setMode = (mode: EventMode) => {
    if (mode === "irl") {
      onChange({
        ...value,
        event_mode: "irl",
        online_format: null,
        online_max_attendees: null,
        watch_party_video_url: "",
        recording_enabled: false,
      });
      return;
    }
    // Pick a default format if switching to online/hybrid without one.
    const fmt = value.online_format ?? "group_room";
    const fmtCfg = getFormatConfig(fmt)!;
    onChange({
      ...value,
      event_mode: mode,
      online_format: fmt,
      online_max_attendees: value.online_max_attendees ?? fmtCfg.defaultCap,
      recording_enabled: value.recording_enabled || fmtCfg.recordsByDefault,
    });
  };

  const setFormat = (fmt: OnlineFormat) => {
    const fmtCfg = getFormatConfig(fmt)!;
    onChange({
      ...value,
      online_format: fmt,
      online_max_attendees: fmtCfg.defaultCap,
      recording_enabled: fmtCfg.recordsByDefault,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border p-3 bg-muted/30">
      <div>
        <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
          <Video className="h-4 w-4 text-primary" /> How will people attend?
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = value.event_mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-center transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-primary/40",
                )}
              >
                <Icon className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.helper}</p>
              </button>
            );
          })}
        </div>
      </div>

      {showOnline && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
              Online format
            </Label>
            <div className="space-y-2">
              {ONLINE_FORMATS.map((f) => {
                const active = value.online_format === f.value;
                const Icon = f.icon;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {f.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          Best for: {f.bestFor}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {cfg && (
            <div className="space-y-2">
              <Label className="text-xs">
                Max online attendees
                <span className="text-muted-foreground font-normal ml-1">
                  (default {cfg.defaultCap}, up to {cfg.maxCap})
                </span>
              </Label>
              <Input
                type="number"
                min={cfg.minCap}
                max={cfg.maxCap}
                value={value.online_max_attendees ?? cfg.defaultCap}
                onChange={(e) =>
                  onChange({
                    ...value,
                    online_max_attendees: Math.max(
                      cfg.minCap,
                      Math.min(cfg.maxCap, parseInt(e.target.value) || cfg.defaultCap),
                    ),
                  })
                }
              />
            </div>
          )}

          {value.online_format === "watch_party" && (
            <div className="space-y-1">
              <Label className="text-xs">Video URL (YouTube or Vimeo)</Label>
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={value.watch_party_video_url}
                onChange={(e) => onChange({ ...value, watch_party_video_url: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Everyone watches this together. You can change it before the event starts.
              </p>
            </div>
          )}

          {cfg && (
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <p className="text-xs font-semibold">Record this event</p>
                <p className="text-[10px] text-muted-foreground">
                  {cfg.value === "podcast"
                    ? "Recommended for repurposing as podcast / clips"
                    : "Saves a video you can share with no-shows"}
                </p>
              </div>
              <Switch
                checked={value.recording_enabled}
                onCheckedChange={(checked) =>
                  onChange({ ...value, recording_enabled: checked })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
