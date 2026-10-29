import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Minimize, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";

export function EPKDocumentViewer({ source, onPages }: { source: string | Blob; onPages?: (count: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const onPagesRef = useRef(onPages);
  onPagesRef.current = onPages;
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    const changed = () => setFullscreen(window.document.fullscreenElement === element);
    window.document.addEventListener("fullscreenchange", changed);
    return () => { observer.disconnect(); window.document.removeEventListener("fullscreenchange", changed); };
  }, []);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    setBusy(true); setError(""); setDocument(undefined); setPage(1);
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      const input = typeof source === "string" ? { url: source } : { data: new Uint8Array(await source.arrayBuffer()) };
      if (!active) return;
      task = pdfjs.getDocument(input);
      const pdf = await task.promise;
      if (active) { setDocument(pdf); onPagesRef.current?.(pdf.numPages); }
    })().catch(() => { if (active) { setError("This PDF could not be opened. Download the original to view it."); setBusy(false); } });
    return () => { active = false; void task?.destroy(); };
  }, [source]);
  useEffect(() => {
    if (!document || !canvas.current || !width) return;
    let active = true;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setBusy(true); setError("");
    void (async () => {
      const pdfPage = await document.getPage(Math.min(page, document.numPages));
      if (!active || !canvas.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.max(0.1, (width - 16) / base.width) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const element = canvas.current;
      element.width = Math.floor(viewport.width * pixelRatio);
      element.height = Math.floor(viewport.height * pixelRatio);
      element.style.width = `${viewport.width}px`;
      element.style.height = `${viewport.height}px`;
      const context = element.getContext("2d");
      if (!context) return;
      render = pdfPage.render({ canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await render.promise;
      if (active) setBusy(false);
    })().catch(e => { if (active && e?.name !== "RenderingCancelledException") { console.warn("EPK page rendering failed", e); setError("Could not render this PDF page."); setBusy(false); } });
    return () => { active = false; render?.cancel(); };
  }, [document, page, width, zoom]);
  return <div ref={container} className="relative flex h-full min-h-0 w-full flex-col bg-background" aria-label="EPK document viewer" aria-busy={busy}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-border px-2 py-1">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous PDF page" disabled={!document || page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-16 text-center text-xs tabular-nums">{page} / {document?.numPages || "—"}</span>
        <Button variant="ghost" size="icon" aria-label="Next PDF page" disabled={!document || page >= document.numPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" title="Fit width" aria-label="Fit PDF width" onClick={() => setZoom(1)}><Scan className="mr-1 h-4 w-4" />{Math.round(zoom * 100)}%</Button>
        <Button variant="ghost" size="icon" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" title="Fullscreen" aria-label={fullscreen ? "Exit PDF fullscreen" : "PDF fullscreen"} onClick={() => { if (fullscreen) void window.document.exitFullscreen(); else void container.current?.requestFullscreen().catch(() => setError("Fullscreen is unavailable in this browser.")); }}>{fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
      </div>
    </div>
    <div className="relative flex-1 overflow-auto bg-muted/30 p-2">
      {busy && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80"><KretopiaLoader /></div>}
      {error && <p role="alert" className="p-6 text-sm text-muted-foreground">{error}</p>}
      <canvas ref={canvas} className="mx-auto block" aria-label={`PDF page ${page}`} />
    </div>
  </div>;
}