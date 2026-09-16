import { supabase } from "@/integrations/supabase/client";

let isLogging = false;

/**
 * Logs a client-side error to the database for monitoring.
 * Silently fails — never throws or interrupts UX.
 */
export async function logClientError(
  error: Error | string,
  componentName?: string,
  metadata?: Record<string, unknown>
) {
  // Prevent recursive logging
  if (isLogging) return;
  isLogging = true;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    await (supabase as any).from("client_error_logs").insert({
      user_id: user?.id || null,
      error_message: typeof error === "string" ? error : error.message,
      error_stack: typeof error === "string" ? null : error.stack?.slice(0, 4000),
      component_name: componentName || null,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      metadata: metadata || null,
    });
  } catch {
    // Silently fail — never crash the app for logging
  } finally {
    isLogging = false;
  }
}

/**
 * Errors we don't care about — noisy browser quirks, not real bugs.
 * Filtered out before persisting to client_error_logs.
 */
const IGNORED_PATTERNS = [
  /Failed to register a ServiceWorker/i,
  /ServiceWorker.*register/i,
  /registerSW\.js/i,
  /sw\.js.*load failed/i,
  /Operation has been aborted/i,
  /Failed to access storage/i,
  /ResizeObserver loop/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /Non-Error promise rejection captured/i,
  /Document is not focused/i, // clipboard noise
  /Load failed$/i, // generic Safari fetch noise
  /^Rejected$/i, // generic abort/cancel from in-flight fetches on navigation
  /_leaflet_pos/i, // leaflet race condition on rapid unmount — cosmetic
  /Failed to fetch dynamically imported module/i, // stale chunk after deploy — auto-recovers on reload
  /Importing a module script failed/i, // same as above (Safari variant)
  /AbortError/i, // user-initiated cancellations
  /Maximum call stack size exceeded/i, // recursion blow-up — logging it cascades
  /null is not an object \(evaluating '.*postMessage'\)/i, // realtime/iframe transport race
];

/** Also check the stack trace for known noisy sources. */
const IGNORED_STACK_PATTERNS = [
  /registerSW\.js/i,
  /serviceWorker\.register/i,
  /sw\.js/i,
];

function shouldIgnore(message: string, stack?: string): boolean {
  if (IGNORED_PATTERNS.some((re) => re.test(message))) return true;
  if (stack && IGNORED_STACK_PATTERNS.some((re) => re.test(stack))) return true;
  return false;
}

/**
 * Sets up global error handlers to catch unhandled errors and rejections.
 */
export function setupGlobalErrorLogging() {
  window.addEventListener("error", (event) => {
    const msg = String(event.error?.message || event.message || "");
    const stack = event.error?.stack || "";
    if (shouldIgnore(msg, stack)) return;
    // Also ignore by filename
    if (event.filename && /registerSW\.js|sw\.js/i.test(event.filename)) return;
    logClientError(
      event.error || event.message,
      "GlobalErrorHandler",
      { filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || "");
    const stack = reason instanceof Error ? (reason.stack || "") : "";
    if (shouldIgnore(msg, stack)) return;
    const errorMsg = reason instanceof Error 
      ? reason 
      : String(reason || 'Unknown rejection');
    logClientError(
      errorMsg,
      "UnhandledPromiseRejection",
      { 
        reasonType: typeof reason,
        reasonConstructor: reason?.constructor?.name,
        stack: reason?.stack?.slice(0, 2000),
      }
    );
  });
}
