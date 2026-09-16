import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/ui/page-header";
import { Radio } from "lucide-react";
import { LiveCallsPanel } from "@/components/circle/LiveCallsPanel";
import { KretoTip } from "@/components/agent/KretoTip";

/**
 * Sound Stages — standalone live/on-air page.
 * No tabs, no Discover chrome. Just what's on the air right now.
 */
export default function SoundStages() {
  return (
    <div className="min-h-screen bg-background pb-28">
      <SEO
        title="Sound Stages — Live rooms on Kretopia"
        description="Drop into live stages, panels and open mics with other creators."
      />
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <PageHeader
          eyebrow="On air"
          title="Sound Stages"
          subtitle="Live rooms, open mics and panels."
          icon={Radio}
          size="sm"
        />
        <div className="mt-3">
          <KretoTip surface="discover" compact />
        </div>
        <div className="mt-4">
          <LiveCallsPanel />
        </div>
      </div>
    </div>
  );
}
