import { Card } from "@/components/ui/card";
import { Bell, MessageCircle, Heart, Briefcase, Calendar, Crown } from "lucide-react";

const NOTIFICATION_TYPES = [
  { icon: MessageCircle, label: "Messages & connection requests", desc: "When someone messages you or wants to connect." },
  { icon: Heart, label: "Matches & likes", desc: "When you match with someone in Circle or get a like." },
  { icon: Briefcase, label: "Gig opportunities", desc: "New gigs in your niche, application status updates, and offers." },
  { icon: Calendar, label: "Events & sessions", desc: "Reminders for events you've RSVP'd to and nearby sessions." },
  { icon: Crown, label: "Platform updates", desc: "The Monday Drop, magazine releases, and big platform news." },
];

export function PushNotificationsInfo() {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">What you'll be notified about</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            We only send what's useful — never spam. You can turn off push at any time.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {NOTIFICATION_TYPES.map(({ icon: Icon, label, desc }) => (
          <li key={label} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        Push works on Chrome, Edge, Firefox, and on iOS/Android when you've installed Kretopia to your home screen.
        Email notifications follow your separate email preferences.
      </p>
    </Card>
  );
}
