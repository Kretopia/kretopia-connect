import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { KretopiaQRCode } from "@/components/brand/KretopiaQRCode";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { APP_URL } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { describeCard, retroYears, retrospectiveCards, summarizeRetrospective } from "@/lib/passport/retrospective";
import { drawRetrospectiveCard, RETRO_EXPORT, RETRO_QR_SIZE } from "@/lib/passport/retrospectiveCanvas";
import { loadEarliestActivity, loadRetrospectiveInputs, type RetroClient } from "@/lib/passport/retrospectiveData";
import { canvasToBlob, downloadBlob, retroFileName, shareOrDownloadImage } from "@/lib/passport/retrospectiveExport";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  name: string;
}

const client = supabase as unknown as RetroClient;

/**
 * "Your year on Kretopia": pick a year, flip through the cards, then save or share a vertical picture of the one on
 * screen. Counts come from `lib/passport/retrospective.ts` (rules written there). Kretopia makes the picture; it does
 * not post it anywhere.
 */
export function PassportRetrospectiveDialog({ open, onOpenChange, userId, name }: Props) {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mark, setMark] = useState<HTMLImageElement | null>(null);
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [fontTick, setFontTick] = useState(0);

  const earliest = useQuery({ queryKey: ["passport-retro-earliest", userId], queryFn: () => loadEarliestActivity(client, userId), enabled: open, staleTime: 5 * 60_000 });
  const inputs = useQuery({ queryKey: ["passport-retro", userId, year], queryFn: () => loadRetrospectiveInputs(client, userId, year), enabled: open, staleTime: 5 * 60_000 });

  const years = useMemo(() => retroYears(earliest.data), [earliest.data]);
  const summary = useMemo(
    () => (inputs.data ? summarizeRetrospective({ year, credits: inputs.data.credits, received: inputs.data.received, given: inputs.data.given }) : null),
    [inputs.data, year],
  );
  const cards = useMemo(() => (summary?.hasActivity ? retrospectiveCards(summary, name) : []), [summary, name]);
  const card = cards[Math.min(index, Math.max(cards.length - 1, 0))];

  useEffect(() => { setIndex(0); }, [year, cards.length]);

  // The K mark is loaded once; until it arrives (or if it cannot load) a drawn letter stands in for it.
  useEffect(() => {
    if (!open) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setMark(image);
    image.onerror = () => setMark(null);
    image.src = kMarkAsset.url;
  }, [open]);

  // Redraw once the page's fonts are ready, so the picture uses the same type as the app.
  useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => { if (!cancelled) setFontTick((n) => n + 1); });
    return () => { cancelled = true; };
  }, []);

  const needsQr = card?.kind === "closing";
  const waitingForQr = needsQr && !qrImage && !qrFailed;

  // One drawing is both what is previewed and what is saved.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !card) return;
    drawRetrospectiveCard(ctx, card, {
      fontFamily: getComputedStyle(document.body).fontFamily,
      assets: { mark, qr: needsQr ? qrImage : null },
    });
  }, [card, mark, qrImage, needsQr, fontTick]);

  const onQrReady = (blob: Blob | null) => {
    if (!blob) { setQrFailed(true); return; }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { setQrImage(image); URL.revokeObjectURL(url); };
    image.onerror = () => { setQrFailed(true); URL.revokeObjectURL(url); };
    image.src = url;
  };

  const makeBlob = async () => {
    if (!canvasRef.current || !card) throw new Error("Nothing to draw");
    return canvasToBlob(canvasRef.current);
  };

  const download = async () => {
    if (!card) return;
    setBusy("download");
    try {
      downloadBlob(await makeBlob(), retroFileName(year, card.kind));
      toast.success("Image saved. Post it from your gallery.");
    } catch {
      toast.error("Couldn't create the image. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!card) return;
    setBusy("share");
    try {
      const outcome = await shareOrDownloadImage(await makeBlob(), retroFileName(year, card.kind), { title: `My ${year} on Kretopia` });
      if (outcome === "downloaded") toast.success("Image saved. Post it from your gallery.");
    } catch {
      toast.error("Couldn't create the image. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const go = (delta: number) => setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(cards.length - 1, 0)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Your year on Kretopia</DialogTitle>
          <DialogDescription>Counts from your Passport. Save or share a picture; Kretopia does not post it for you.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <label htmlFor="retro-year" className="text-sm font-medium">Year</label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger id="retro-year" className="h-10 w-40" aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y === currentYear ? `${y} so far` : y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {inputs.isLoading ? (
          <div className="grid h-64 place-items-center"><KretopiaLoader /></div>
        ) : inputs.isError ? (
          <div role="alert" className="space-y-3 rounded-lg border border-border p-4 text-sm">
            <p>Couldn't load your activity for {year}.</p>
            <Button size="sm" variant="outline" onClick={() => void inputs.refetch()}>Try again</Button>
          </div>
        ) : !summary?.hasActivity ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-4 text-sm">
            <p className="font-medium">{`Nothing to show for ${year}${year === currentYear ? " yet" : ""}.`}</p>
            <p className="text-muted-foreground">Credits you add and co-signs you receive or give in a year appear here.</p>
            <Button asChild size="sm" variant="outline"><Link to="/credits" onClick={() => onOpenChange(false)}>Add a credit</Link></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {inputs.data?.truncated && <p className="text-xs text-muted-foreground">Very large history: the counts may be slightly short.</p>}
            <div
              role="group"
              aria-roledescription="carousel"
              aria-label="Year cards"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
              className="mx-auto w-full max-w-[270px] overflow-hidden rounded-2xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <canvas
                ref={canvasRef}
                width={RETRO_EXPORT.width}
                height={RETRO_EXPORT.height}
                role="img"
                aria-label={card ? describeCard(card) : "Year card"}
                className="block aspect-[9/16] h-auto w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" size="icon" variant="outline" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous card"><ChevronLeft className="h-4 w-4" /></Button>
              <span role="status" aria-live="polite" className="text-xs text-muted-foreground">Card {Math.min(index, cards.length - 1) + 1} of {cards.length}</span>
              <Button type="button" size="icon" variant="outline" onClick={() => go(1)} disabled={index >= cards.length - 1} aria-label="Next card"><ChevronRight className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10 gap-1.5 px-2" onClick={() => void download()} disabled={busy !== null || waitingForQr}>
                <Download className="h-4 w-4" aria-hidden />Download image
              </Button>
              <Button className="h-10 gap-1.5 px-2" onClick={() => void share()} disabled={busy !== null || waitingForQr}>
                <Share2 className="h-4 w-4" aria-hidden />Share
              </Button>
            </div>

            {/* The branded QR is drawn here, off screen, and its bitmap is placed on the closing card. */}
            {needsQr && (
              <div aria-hidden style={{ position: "fixed", left: -10000, top: 0 }}>
                <KretopiaQRCode key={card.kind} data={`${APP_URL}/epk/${userId}`} size={RETRO_QR_SIZE} onReady={onQrReady} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PassportRetrospectiveDialog;
