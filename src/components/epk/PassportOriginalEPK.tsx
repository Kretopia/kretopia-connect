import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { epkPassportPath } from "@/lib/epkDocument";
import { EPKDocumentViewer } from "./EPKDocumentViewer";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export function PassportOriginalEPK({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ["passport-original-epk", userId], staleTime: 60_000,
    queryFn: async () => {
      const { data: url } = supabase.storage.from("portfolio").getPublicUrl(epkPassportPath(userId));
      const response = await fetch(url.publicUrl, { method: "HEAD", cache: "no-cache" });
      return response.ok && response.headers.get("content-type")?.includes("pdf") ? `${url.publicUrl}?v=${encodeURIComponent(response.headers.get("etag") || "current")}` : null;
    }, retry: false,
  });
  if (!data) return null;
  return <section className="w-full space-y-3 py-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><BrandLogo iconOnly size="sm" /><h3 className="text-sm font-semibold">Press kit</h3><span className="text-xs text-muted-foreground">Original PDF</span></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setExpanded(v => !v)}><FileText className="mr-1 h-4 w-4" />{expanded ? "Close" : "View EPK"}</Button><Button variant="ghost" size="icon" asChild title="Download EPK"><a href={data} target="_blank" rel="noopener noreferrer" aria-label="Download original EPK"><Download className="h-4 w-4" /></a></Button></div>
    </div>
    {expanded && <div className="h-[75dvh] min-h-80 w-full overflow-hidden rounded-lg border border-border"><EPKDocumentViewer source={data} /></div>}
  </section>;
}