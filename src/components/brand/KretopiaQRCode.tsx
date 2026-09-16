import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";

const ENERGY = "#FF2DA1";
const MIDNIGHT = "#0B0B10";

interface KretopiaQRCodeProps {
  /** The URL (or any string payload) the code should resolve to. */
  data: string;
  /** Pixel width/height — the code is always square. */
  size?: number;
  className?: string;
}

/**
 * The one Kretopia-branded QR look, extracted from EventPassCard so any
 * surface that needs "scan this to open on your phone" (event passes,
 * Magazine articles, ...) renders the exact same mark instead of a plain
 * black-and-white code: extra-rounded dots on a midnight->pink gradient,
 * pink corner squares, midnight corner dots, the Kretopia K embedded in
 * the center.
 */
// Below this, qr-code-styling throws an unhandled "canvas is too small"
// rejection once the encoded data is a full URL at error-correction level
// H -- and a code that small isn't reliably scannable from a screen
// anyway, so this is the real floor, not just a crash workaround.
const MIN_SIZE = 100;

export function KretopiaQRCode({ data, size: requestedSize = 120, className }: KretopiaQRCodeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const size = Math.max(requestedSize, MIN_SIZE);

  useEffect(() => {
    if (!data || !ref.current) return;
    let cancelled = false;
    ref.current.innerHTML = "";

    const baseOptions = {
      width: size,
      height: size,
      data,
      margin: Math.max(4, Math.round(size * 0.03)),
      qrOptions: { errorCorrectionLevel: "H" as const },
      dotsOptions: {
        type: "extra-rounded" as const,
        gradient: {
          type: "linear" as const,
          rotation: Math.PI / 4,
          colorStops: [
            { offset: 0, color: MIDNIGHT },
            { offset: 1, color: ENERGY },
          ],
        },
      },
      cornersSquareOptions: { color: ENERGY, type: "extra-rounded" as const },
      cornersDotOptions: { color: MIDNIGHT, type: "dot" as const },
      backgroundOptions: { color: "#ffffff" },
    };

    const render = (withLogo: boolean) => {
      if (cancelled || !ref.current) return;
      const qr = new QRCodeStyling(
        withLogo
          ? {
              ...baseOptions,
              image: kMarkAsset.url,
              imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 6, crossOrigin: "anonymous" },
            }
          : baseOptions,
      );
      qr.append(ref.current);
    };

    // Same rule as EventPassCard: the center logo is a branding touch, never
    // a hard dependency — a failed image load must not leave a blank canvas.
    const probe = new Image();
    probe.onload = () => render(true);
    probe.onerror = () => render(false);
    probe.src = kMarkAsset.url;

    return () => {
      cancelled = true;
    };
  }, [data, size]);

  return <div ref={ref} className={className} style={{ width: size, height: size }} aria-hidden />;
}

export default KretopiaQRCode;
