const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Returns the URL only when it uses a safe scheme (or is relative); otherwise undefined. */
export function safeHref(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  // Strip control/whitespace characters browsers ignore when parsing schemes.
  const probe = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
  try {
    const url = new URL(probe, "https://www.kretopia.com");
    return SAFE_SCHEMES.has(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Payload allowed inside printed/shared QR codes: absolute http(s) only, max
 * 2048 chars. A scanned code opens outside the app's link guard, so unsafe
 * schemes or relative paths must never be encoded.
 */
export function safeQrPayload(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value || value.length > 2048) return undefined;
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Capture-phase guard: blocks clicks on links whose href resolves to an unsafe
 * scheme (javascript:, data:, vbscript:, ...) anywhere in the app, and adds
 * noopener to new-tab links. Defense in depth for user-supplied URLs.
 */
export function installUnsafeLinkGuard(doc: Document = document): () => void {
  const onClick = (event: Event) => {
    const target = event.target as Element | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    if (!safeHref(href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (anchor.target === "_blank") {
      const rel = new Set((anchor.rel || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      anchor.rel = [...rel].join(" ");
    }
  };
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("auxclick", onClick, true);
  return () => {
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("auxclick", onClick, true);
  };
}
