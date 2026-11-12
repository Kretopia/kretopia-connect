import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventLocalToUtc, eventTimeZoneLabel, formatEventTime } from "@/lib/eventTime";

interface Props {
  timezone: string;
  onTimezoneChange: (zone: string) => void;
  localStart: string;
  localEnd: string;
  onEndChange: (value: string) => void;
}

export function EventTimeZoneFields({ timezone, onTimezoneChange, localStart, localEnd, onEndChange }: Props) {
  const zones = useMemo(() => {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    return [...new Set([timezone, "UTC", "Asia/Makassar", ...(intl.supportedValuesOf?.("timeZone") || ["America/New_York", "Europe/London", "Asia/Jakarta", "Asia/Tokyo", "Australia/Sydney"])])].sort();
  }, [timezone]);
  let instant: Date | undefined;
  try { if (localStart) instant = new Date(eventLocalToUtc(localStart, timezone)); } catch { /* Validation is reported on save. */ }
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="event-timezone">Time zone *</Label>
        <Select required value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger id="event-timezone" className="min-w-0"><SelectValue /></SelectTrigger>
          <SelectContent>{zones.map(zone => <SelectItem key={zone} value={zone}>{eventTimeZoneLabel(zone, instant)}</SelectItem>)}</SelectContent>
        </Select>
        {instant && <p className="text-sm text-muted-foreground break-words">{formatEventTime(instant.toISOString(), timezone)} — {eventTimeZoneLabel(timezone, instant)}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="event-end">End date and time (optional)</Label>
        <Input id="event-end" type="datetime-local" value={localEnd} onChange={e => onEndChange(e.target.value)} />
      </div>
    </>
  );
}