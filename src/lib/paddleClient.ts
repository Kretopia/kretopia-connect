// Opens a Paddle checkout that the SERVER created. The browser never chooses a price, a tier or whom the purchase is for: it receives a
// transaction id and a public client token (public by design) and hands them to Paddle.js. Nothing here changes a plan: the plan
// changes when Paddle's signed webhook says so, and the success page reads that authoritative status.
//
// Paddle.js is loaded on demand from Paddle's CDN (no npm dependency, no bytes for members who never open checkout).

const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

interface PaddleGlobal {
  Environment: { set(env: "sandbox"): void };
  Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void;
  Checkout: { open(options: { transactionId: string; settings?: Record<string, unknown> }): void };
}

declare global {
  interface Window { Paddle?: PaddleGlobal }
}

export interface PaddleCheckoutStart {
  provider: "paddle";
  transactionId: string;
  clientToken: string;
  environment: "sandbox" | "live";
}

export const isPaddleCheckout = (value: unknown): value is PaddleCheckoutStart => {
  const v = value as Partial<PaddleCheckoutStart> | null;
  return !!v && v.provider === "paddle" && typeof v.transactionId === "string" && typeof v.clientToken === "string" && (v.environment === "sandbox" || v.environment === "live");
};

let loading: Promise<PaddleGlobal> | null = null;

function loadPaddle(): Promise<PaddleGlobal> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (!loading) {
    loading = new Promise<PaddleGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PADDLE_JS;
      script.async = true;
      script.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle did not load")));
      script.onerror = () => { loading = null; script.remove(); reject(new Error("Checkout could not load. Check your connection and try again.")); };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** A Paddle client-side token belongs to one environment ("test_" sandbox, "live_" live); a mismatch is a configuration error, not a checkout. */
export function tokenMatchesEnvironment(token: string | undefined, environment: string | undefined): environment is "sandbox" | "live" {
  if (!token) return false;
  return (environment === "sandbox" && token.startsWith("test_")) || (environment === "live" && token.startsWith("live_"));
}

/** Loads and initialises Paddle.js. With a `_ptxn` parameter in the URL (a payment link) Paddle.js opens that transaction by itself. */
export async function initializePaddle(environment: "sandbox" | "live", token: string, eventCallback?: (event: { name?: string }) => void): Promise<void> {
  const paddle = await loadPaddle();
  if (environment === "sandbox") paddle.Environment.set("sandbox");
  paddle.Initialize({ token, eventCallback });
}

export async function openPaddleCheckout(start: PaddleCheckoutStart, returnTo: string = `${window.location.origin}/payment-success?provider=paddle`): Promise<void> {
  const paddle = await loadPaddle();
  if (start.environment === "sandbox") paddle.Environment.set("sandbox");
  paddle.Initialize({ token: start.clientToken });
  paddle.Checkout.open({ transactionId: start.transactionId, settings: { displayMode: "overlay", successUrl: returnTo } });
}
