import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SitePreviewPanelProps {
  siteUrl: string;
  className?: string;
}

const DEVICES = [
  { id: 'desktop', icon: Monitor, width: '100%', label: 'Desktop' },
  { id: 'tablet', icon: Tablet, width: '768px', label: 'Tablet' },
  { id: 'mobile', icon: Smartphone, width: '375px', label: 'Mobile' },
] as const;

export const SitePreviewPanel = ({ siteUrl, className }: SitePreviewPanelProps) => {
  const [device, setDevice] = useState<string>('desktop');
  const [key, setKey] = useState(0);

  const currentDevice = DEVICES.find(d => d.id === device) || DEVICES[0];
  const iframeWidth = currentDevice.width;

  return (
    <div className={cn("flex flex-col h-full border rounded-xl bg-muted/30 overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          {DEVICES.map((d) => (
            <Button
              key={d.id}
              variant={device === d.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setDevice(d.id)}
              title={d.label}
            >
              <d.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setKey(k => k + 1)}
            title="Refresh preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            asChild
          >
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* URL bar */}
      <div className="px-3 py-1.5 border-b bg-muted/50">
        <div className="flex items-center gap-2 bg-background rounded-md px-2 py-1">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <code className="text-[10px] text-muted-foreground truncate flex-1">{siteUrl}</code>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-[#e5e5e5] p-2">
        <div
          className="bg-white rounded-md shadow-lg overflow-hidden transition-all duration-300 h-full"
          style={{ width: iframeWidth, maxWidth: '100%' }}
        >
          <iframe
            key={key}
            src={siteUrl}
            className="w-full h-full border-0"
            title="Site Preview"
            style={{ minHeight: '600px' }}
          />
        </div>
      </div>
    </div>
  );
};
