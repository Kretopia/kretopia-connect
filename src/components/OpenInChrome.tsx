import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openInChromeHref } from "@/lib/pwaInstall";

/** What Samsung Internet shows instead of "Install app": its installer makes a package Android blocks, Chrome's does not (src/lib/pwaInstall.ts). */
export function OpenInChrome({ href }: { href?: string }) {
  const target = href ?? new URL("/install", window.location.origin).href;
  return (
    <div className="space-y-3" data-testid="open-in-chrome">
      <p className="text-sm font-medium">Install Kretopia from Chrome</p>
      <p className="text-xs text-muted-foreground">
        Samsung Internet builds an app package that Android's Play Protect blocks as unsafe. Chrome's is safe: open this page in Chrome, then tap Install.
      </p>
      <Button asChild className="w-full" size="lg">
        <a href={openInChromeHref(target)}>
          <ExternalLink className="mr-2 h-5 w-5" aria-hidden />
          Open in Chrome
        </a>
      </Button>
    </div>
  );
}
