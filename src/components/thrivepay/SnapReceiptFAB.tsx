import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera as CameraIcon, Loader2, Check, X, Sparkles, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { recordMoneyAction } from "@/lib/moneyStreak";
import { EXPENSE_CATEGORIES, getCategoryInfo } from "@/components/project/expense/ExpenseCategories";
import { Capacitor } from "@capacitor/core";
import { Camera as NativeCamera, CameraResultType, CameraSource } from "@capacitor/camera";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "ZAR", "NGN", "KES", "JPY", "INR", "BRL", "TTD", "AED"];

const normalizeCategory = (category?: string) => {
  const raw = category?.toLowerCase().trim();
  const aliases: Record<string, string> = {
    contractor: "contractors",
    rent: "workspace",
    utilities: "workspace",
    transport: "travel",
    transportation: "travel",
    supplies: "equipment",
  };
  const candidate = aliases[raw || ""] || raw || "other";
  return EXPENSE_CATEGORIES.some((c) => c.value === candidate) ? candidate : "other";
};

const emptyReceiptForm = () => ({
  title: "",
  vendor: "",
  amount: "",
  currency: "USD",
  date: new Date().toISOString().split("T")[0],
  category: "other",
  tax_deductible: false,
  notes: "",
});

interface ScannedReceipt {
  title?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  tax_deductible?: boolean;
  notes?: string;
  line_items?: Array<{ description: string; amount: number }>;
}

interface DebugStep {
  time: string;
  message: string;
  detail?: string;
  level?: "info" | "success" | "error";
}

interface SnapReceiptFABProps {
  projectId?: string;
}

type ReceiptImageInput = {
  base64: string;
  previewUrl: string;
  label: string;
  sizeKb?: number;
};

/**
 * SnapReceiptFAB
 * - Tap → opens camera immediately
 * - Photo → AI scan via edge function
 * - Shows REVIEW SHEET with all fields editable + line items preview
 * - User taps "Add to expenses" → saves directly to DB
 */
export function SnapReceiptFAB({ projectId }: SnapReceiptFABProps) {
  const { user } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingPickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanned, setScanned] = useState<ScannedReceipt | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);
  const [form, setForm] = useState(emptyReceiptForm);

  const addDebug = (message: string, detail?: string, level: DebugStep["level"] = "info") => {
    setDebugSteps((prev) => [
      ...prev.slice(-9),
      {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        message,
        detail: detail ? detail.slice(0, 1400) : undefined,
        level,
      },
    ]);
  };

  const formatErrorDetail = (err: unknown) => {
    if (!err) return "No error object was returned.";
    if (err instanceof Error) return `${err.name}: ${err.message}${err.stack ? `\n${err.stack.slice(0, 900)}` : ""}`;
    if (typeof err === "object") {
      try {
        return JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
      } catch {
        return String(err);
      }
    }
    return String(err);
  };

  const clearPickerTimer = () => {
    if (pendingPickerTimer.current) {
      clearTimeout(pendingPickerTimer.current);
      pendingPickerTimer.current = null;
    }
  };

  const beginPicker = (mode: "camera" | "upload") => {
    clearPickerTimer();
    pendingPickerTimer.current = setTimeout(() => {
      const inputReady = mode === "camera" ? Boolean(cameraRef.current) : Boolean(uploadRef.current);
      setDebugOpen(true);
      addDebug(
        mode === "camera" ? "Take photo did not return an image" : "Upload did not return an image",
        `Input ready: ${inputReady ? "yes" : "no"}. Signed in: ${user?.id ? "yes" : "no"}. Browser: ${navigator.userAgent}\n\nIf the camera/gallery did not open, this WebView may be blocking native file picking or camera permission may be denied.`,
        "error",
      );
    }, 15000);
  };

  useEffect(() => {
    if (cameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => addDebug("Camera preview failed to start", formatErrorDetail(err), "error"));
    }
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    const handler = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: "camera" | "upload" }>).detail?.mode;
      if (mode === "camera") {
        isNativeCameraReady() ? openNativeImage(CameraSource.Camera) : startInlineCamera();
        return;
      }
      if (mode === "upload") {
        isNativeCameraReady() ? openNativeImage(CameraSource.Photos) : uploadRef.current?.click();
        return;
      }
      setPickerOpen(true);
    };
    window.addEventListener("thrivepay:scan-receipt", handler as EventListener);
    return () => window.removeEventListener("thrivepay:scan-receipt", handler as EventListener);
  }, [cameraStream, scanning, user?.id]);

  useEffect(() => () => {
    clearPickerTimer();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [previewUrl, cameraStream]);

  const compressImage = (f: File, maxWidth = 1200, quality = 0.7): Promise<string> =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The selected image could not be loaded for compression."));
      };
      img.src = objectUrl;
    });

  const isNativeCameraReady = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Camera");

  const stopInlineCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const startInlineCamera = async () => {
    clearPickerTimer();
    setPickerOpen(false);
    setScanError(null);
    setCameraStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not available in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      setCameraStream(stream);
      setCameraOpen(true);
      addDebug("Camera opened", "Using the in-app camera preview instead of the Android file-picker capture flow.", "success");
    } catch (err) {
      if (cameraRef.current) {
        addDebug("Camera preview unavailable", "Falling back to the browser camera picker.", "info");
        beginPicker("camera");
        cameraRef.current.click();
        setCameraStarting(false);
        return;
      }
      setDebugOpen(true);
      setScanError(err instanceof Error ? err.message : "Camera could not open");
      addDebug("Camera open failed", formatErrorDetail(err), "error");
      toast.error("Camera could not open. Try Upload screenshot.");
    } finally {
      setCameraStarting(false);
    }
  };

  const openNativeImage = async (source: CameraSource) => {
    clearPickerTimer();
    setPickerOpen(false);
    setScanError(null);
    try {
      const photo = await NativeCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
        correctOrientation: true,
      });

      if (!photo.base64String) throw new Error("The selected image did not return image data.");
      const preview = `data:image/${photo.format || "jpeg"};base64,${photo.base64String}`;
      await processReceiptImage({
        base64: photo.base64String,
        previewUrl: preview,
        label: source === CameraSource.Camera ? "camera-photo" : "uploaded-receipt",
        sizeKb: Math.round((photo.base64String.length * 3) / 4 / 1024),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || "Image picker was closed");
      if (!/cancel/i.test(message)) {
        setDebugOpen(true);
        setScanError(message);
        addDebug(source === CameraSource.Camera ? "Native camera failed" : "Native upload failed", formatErrorDetail(err), "error");
        toast.error(source === CameraSource.Camera ? "Camera could not open. Try Upload screenshot." : "Upload could not open.");
      }
    }
  };

  const processReceiptImage = async (image: ReceiptImageInput) => {
    if (!user) {
      addDebug("Scan stopped: no signed-in user", "The image was selected, but there is no active user session for saving expenses.", "error");
      toast.error("Sign in again before scanning receipts.");
      return;
    }

    setPickerOpen(false);
    setDebugOpen(false);
    addDebug("Image received", `${image.label} • image/jpeg • ${image.sizeKb ? `${image.sizeKb.toFixed(1)} KB` : "ready"}`);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(image.previewUrl);
    setScanned(null);
    setScanError(null);
    setForm(emptyReceiptForm());
    setReviewOpen(true);
    setScanning(true);
    toast.loading("Reading your receipt…", { id: "snap-receipt" });
    try {
      addDebug("Image ready for scanner", `Base64 payload length: ${image.base64.length.toLocaleString()} characters`);
      addDebug("Calling receipt scanner function");
      const { data, error } = await supabase.functions
        .invoke("scan-receipt", { body: { image_base64: image.base64 } })
        .catch((err) => {
          addDebug("Receipt scanner request failed", formatErrorDetail(err), "error");
          return { data: null, error: err };
        });

      if (error) throw error;
      if (!data || data?.error) throw new Error(data?.error || "No data extracted");

      const d = data as ScannedReceipt;
      addDebug("Receipt data extracted", JSON.stringify(d, null, 2), "success");
      setScanned(d);
      setForm({
        title: d.title || d.vendor || "Receipt",
        vendor: d.vendor || "",
        amount: d.amount?.toString() || "",
        currency: d.currency || "USD",
        date: d.date || new Date().toISOString().split("T")[0],
        category: normalizeCategory(d.category),
        tax_deductible: d.tax_deductible ?? false,
        notes:
          d.notes ||
          (d.line_items?.length
            ? `Items: ${d.line_items.map((i) => `${i.description} (${d.currency || ""} ${i.amount})`).join(", ")}`
            : ""),
      });
      setScanError(null);
      setReviewOpen(true);
      toast.success("Got it — review and add.", { id: "snap-receipt" });
    } catch (err: any) {
      const message = err?.message || "Couldn't read that receipt";
      setScanError(message);
      addDebug("Scan failed", formatErrorDetail(err), "error");
      setReviewOpen(true);
      toast.error("Couldn't read it automatically — review it here.", { id: "snap-receipt" });
    } finally {
      setScanning(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const processReceiptFile = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    try {
      addDebug("Compressing image for scanner");
      const base64 = await compressImage(file);
      await processReceiptImage({
        base64,
        previewUrl: objectUrl,
        label: file.name || "receipt-image",
        sizeKb: file.size / 1024,
      });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      const message = err instanceof Error ? err.message : "Could not prepare the image";
      setScanError(message);
      setDebugOpen(true);
      addDebug("Image preparation failed", formatErrorDetail(err), "error");
      toast.error(message);
    }
  };

  const captureInlinePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera preview is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      toast.error("Could not capture photo.");
      return;
    }
    stopInlineCamera();
    await processReceiptFile(new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    clearPickerTimer();
    const file = e.target.files?.[0];
    if (!file) {
      addDebug("File picker closed without a file", "No file was returned from the camera/gallery input.", "error");
      return;
    }
    await processReceiptFile(file);
  };

  const handleAdd = async () => {
    if (!user) return;
    if (!form.amount || isNaN(parseFloat(form.amount))) {
      addDebug("Save blocked", `Invalid amount: ${form.amount || "empty"}`, "error");
      toast.error("Enter an amount");
      return;
    }
    if (!form.title.trim()) {
      addDebug("Save blocked", "Title is empty.", "error");
      toast.error("Add a title");
      return;
    }
    setSaving(true);
    addDebug(
      "Saving expense",
      JSON.stringify({ project_id: projectId || null, title: form.title, amount: form.amount, currency: form.currency, category: form.category, vendor: form.vendor, date: form.date }, null, 2),
    );
    try {
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        project_id: projectId || null,
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        category: form.category,
        vendor: form.vendor || null,
        date: form.date,
        notes: form.notes || null,
        tax_deductible: form.tax_deductible,
        is_recurring: false,
        payment_method: "card",
      });
      if (error) throw error;
      recordMoneyAction("expense_added").catch(() => {});
      addDebug("Expense saved", "The expense insert succeeded and the refresh event was sent.", "success");
      toast.success(`Added ${form.currency} ${form.amount} to expenses`);
      setReviewOpen(false);
      setPreviewUrl(null);
      setScanned(null);
      // Tell any open expense lists to refresh
      window.dispatchEvent(new CustomEvent("thrivepay:expense-added"));
    } catch (err: any) {
      setScanError(err?.message || "Couldn't save expense");
      addDebug("Save failed", formatErrorDetail(err), "error");
      toast.error(err?.message || "Couldn't save expense");
    } finally {
      setSaving(false);
    }
  };

  const cat = getCategoryInfo(form.category);

  return (
    <>
      <Button
        type="button"
        disabled={scanning}
        aria-label="Scan a receipt"
        onClick={() => setPickerOpen((open) => !open)}
        data-snap-receipt-fab
        className="snap-receipt-fab fixed right-4 z-[60] h-14 rounded-full px-4 gap-2 shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
      >
        {scanning ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" />
        ) : (
          <CameraIcon className="h-6 w-6 text-primary-foreground" />
        )}
        <span className="text-xs font-semibold text-primary-foreground">Scan</span>
      </Button>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onClick={() => beginPicker("camera")}
        onChange={handleFile}
        disabled={scanning}
      />

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onClick={() => beginPicker("upload")}
        onChange={handleFile}
        disabled={scanning}
      />

      {pickerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80]" role="presentation">
          <button
            type="button"
            aria-label="Close scan options"
            className="absolute inset-0 bg-transparent"
            onClick={() => setPickerOpen(false)}
          />
          <div
            role="menu"
            aria-label="Receipt scan options"
            className="absolute right-4 w-60 rounded-xl border bg-popover p-2 text-popover-foreground shadow-2xl"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 9.5rem)" }}
          >
            <div className="space-y-1">
            <button
              type="button"
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[hsl(var(--energy)/0.1)] text-left transition-colors cursor-pointer overflow-hidden disabled:opacity-50"
              onClick={() => isNativeCameraReady() ? openNativeImage(CameraSource.Camera) : startInlineCamera()}
              disabled={scanning || cameraStarting}
            >
              <CameraIcon className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{cameraStarting ? "Opening camera…" : "Take photo"}</div>
                <div className="text-[11px] text-muted-foreground">Snap a paper receipt</div>
              </div>
            </button>
            <button
              type="button"
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[hsl(var(--energy)/0.1)] text-left transition-colors cursor-pointer overflow-hidden disabled:opacity-50"
              onClick={() => isNativeCameraReady() ? openNativeImage(CameraSource.Photos) : uploadRef.current?.click()}
              disabled={scanning}
            >
              <ImagePlus className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Upload screenshot</div>
                <div className="text-[11px] text-muted-foreground">From gallery or files</div>
              </div>
            </button>
          </div>
          </div>
        </div>,
        document.body,
      )}

      {cameraOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[95] bg-background" role="dialog" aria-modal="true" aria-label="Receipt camera">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 bg-background/80 px-4 py-3 text-center text-sm font-semibold text-foreground">
            Fit the receipt inside the frame
          </div>
          <div className="absolute inset-x-0 bottom-0 flex gap-3 bg-background/90 px-4 py-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
            <Button type="button" variant="outline" className="flex-1" onClick={stopInlineCamera}>Cancel</Button>
            <Button type="button" className="flex-1 bg-primary" onClick={captureInlinePhoto}>Use photo</Button>
          </div>
        </div>,
        document.body,
      )}

      {/* Review & approve panel */}
      {reviewOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[90]" role="presentation">
          <button
            type="button"
            aria-label="Close receipt review"
            className="absolute inset-0 bg-background/80"
            onClick={() => setReviewOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-review-title"
            className="absolute inset-x-0 bottom-0 z-[100] flex h-[92dvh] flex-col rounded-t-2xl border bg-background shadow-2xl"
          >
            <div className="shrink-0 border-b px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 text-left">
                  <h2 id="receipt-review-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Review your receipt
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {scanning ? "Reading the image now — the fields will fill in here." : "Tweak anything, then add to expenses."}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)} disabled={saving} className="h-9 w-9 shrink-0">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {previewUrl && (
                <div className="rounded-xl overflow-hidden border bg-muted/30 max-h-48 flex items-center justify-center">
                  <img src={previewUrl} alt="Scanned receipt" className="max-h-48 object-contain" />
                </div>
              )}

              {scanning && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Capturing the breakdown…
                </div>
              )}

              {scanError && !scanning && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="font-semibold">Receipt scan/save issue</div>
                  <div className="mt-1">{scanError}</div>
                  <div className="mt-1 text-xs text-destructive/80">The receipt stays open so you can fill anything missing and try saving again.</div>
                </div>
              )}

              <div className="rounded-xl border bg-card p-4">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger className="w-24 h-12 text-sm font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="h-12 text-2xl font-bold"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1 h-11">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span>{c.icon}</span>
                          <span>{c.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">What was it for?</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Adobe subscription"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Vendor</Label>
                  <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="—" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Tax deductible</div>
                  <div className="text-[11px] text-muted-foreground">Mark as a business expense</div>
                </div>
                <Switch checked={form.tax_deductible} onCheckedChange={(v) => setForm({ ...form, tax_deductible: v })} />
              </div>

              {scanned?.line_items && scanned.line_items.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Detected items</div>
                  <ul className="space-y-1 text-sm">
                    {scanned.line_items.map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="truncate pr-2">{it.description}</span>
                        <span className="text-muted-foreground tabular-nums">{form.currency} {it.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t bg-background px-4 py-3 flex gap-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
              <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={saving} className="flex-1">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleAdd} disabled={scanning || saving || !form.amount || !form.title.trim()} className="flex-1 bg-primary">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Add to expenses
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
