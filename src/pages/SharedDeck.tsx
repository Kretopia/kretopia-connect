import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { DeckRenderer, type DeckContent } from "@/components/thrive/DeckRenderer";
import type { DeckTheme } from "@/lib/deckThemes";
import { Loader2 } from "lucide-react";

export default function SharedDeck() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_shared_thrive_document", { _token: token });
        if (error) throw error;
        if (!data || data.length === 0) {
          setError("This document isn't available.");
        } else {
          setDoc(data[0]);
          supabase.rpc("increment_thrive_doc_views", { _token: token }).then(() => {}, () => {});
        }
      } catch (e: any) {
        setError(e?.message || "Couldn't load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-center px-6">
        <div>
          <h1 className="text-xl font-semibold mb-2">Not found</h1>
          <p className="text-sm text-muted-foreground">{error || "This link is invalid or the doc was unpublished."}</p>
        </div>
      </div>
    );
  }

  const content = doc.content as DeckContent;

  return (
    <div className="min-h-screen bg-muted/30 py-6">
      <SEO title={doc.title} description={content?.subtitle || "Made with Kretopia"} />
      <div className="max-w-5xl mx-auto px-4">
        <DeckRenderer doc={content} theme={(doc.theme as DeckTheme) || "editorial"} coverImageUrl={doc.cover_image_url} />
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Made with Kreto on <a href="https://www.kretopia.com" className="underline">Kretopia</a> — your Creative Executive Producer.
        </div>
      </div>
    </div>
  );
}
