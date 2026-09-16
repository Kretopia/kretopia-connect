import { loadDaily } from "@/lib/dailyFrame";

export type PreflightIssue =
  | "no-webrtc"
  | "no-getusermedia"
  | "insecure-context"
  | "unsupported-browser"
  | "third-party-blocked"
  | "in-app-browser";

export interface PreflightResult {
  ok: boolean;
  issues: PreflightIssue[];
  /** Human-readable reason (first issue). */
  reason?: string;
  /** Suggested action label for the fallback CTA. */
  ctaLabel?: string;
  /** Browser detection details (when available). */
  browser?: {
    name?: string;
    mobile?: boolean;
    supportsScreenShare?: boolean;
  };
}

const REASONS: Record<PreflightIssue, { reason: string; cta: string }> = {
  "no-webrtc": {
    reason:
      "This browser doesn't support video calls (no WebRTC). Try Chrome, Safari, Firefox, or Edge.",
    cta: "Copy link & open elsewhere",
  },
  "no-getusermedia": {
    reason:
      "We can't reach your camera or mic from this browser. Open the call in your default browser.",
    cta: "Copy link & open elsewhere",
  },
  "insecure-context": {
    reason:
      "Calls require a secure (https) connection. Open the link over https to join.",
    cta: "Copy secure link",
  },
  "unsupported-browser": {
    reason:
      "Your browser version isn't supported by our video provider. Update or switch browsers to join.",
    cta: "Copy link & open elsewhere",
  },
  "third-party-blocked": {
    reason:
      "Third-party content looks blocked here (often inside another app's webview). Open the link in Safari, Chrome, or Firefox to join.",
    cta: "Copy link & open in browser",
  },
  "in-app-browser": {
    reason:
      "You appear to be in an in-app browser (Instagram, TikTok, Messenger, LinkedIn, etc.) — these often block camera & mic. Tap \"…\" then \"Open in browser\".",
    cta: "Copy link",
  },
};

/** Best-effort detection of in-app webviews that commonly break getUserMedia. */
function isInAppBrowser(ua: string): boolean {
  return /(FBAN|FBAV|Instagram|Line|MicroMessenger|TikTok|musical_ly|Snapchat|LinkedInApp|Twitter|Pinterest|GSA)/i.test(
    ua,
  );
}

/** Detect a sandboxed/cross-origin iframe with no storage access. */
function thirdPartyBlocked(): boolean {
  try {
    // If we are top-level, no third-party concerns.
    if (window.top === window.self) return false;
    // Touch storage — sandboxed iframes throw here.
    window.localStorage.setItem("__pf__", "1");
    window.localStorage.removeItem("__pf__");
    return false;
  } catch {
    return true;
  }
}

export async function runCallPreflight(): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    issues.push("insecure-context");
  }

  if (
    typeof window === "undefined" ||
    typeof (window as any).RTCPeerConnection === "undefined"
  ) {
    issues.push("no-webrtc");
  }

  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    issues.push("no-getusermedia");
  }

  if (thirdPartyBlocked()) {
    issues.push("third-party-blocked");
  }

  if (isInAppBrowser(ua)) {
    issues.push("in-app-browser");
  }

  let browserInfo: PreflightResult["browser"];
  try {
    const DailyIframe: any = await loadDaily();
    const sb = DailyIframe?.supportedBrowser?.();
    if (sb) {
      browserInfo = {
        name: sb.browserName,
        mobile: sb.mobile,
        supportsScreenShare: sb.supportsScreenShare,
      };
      if (sb.supported === false) issues.push("unsupported-browser");
    }
  } catch {
    /* non-fatal */
  }

  if (issues.length === 0) {
    return { ok: true, issues: [], browser: browserInfo };
  }

  const first = issues[0];
  return {
    ok: false,
    issues,
    reason: REASONS[first].reason,
    ctaLabel: REASONS[first].cta,
    browser: browserInfo,
  };
}
