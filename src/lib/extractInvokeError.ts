/**
 * Try hard to surface the real error from a supabase.functions.invoke()
 * failure. On a non-2xx response, the SDK returns `data: null` and throws a
 * FunctionsHttpError whose own `.message` is a generic
 * "Edge Function returned a non-2xx status code" — the edge function's
 * actual JSON error body only lives on `error.context` (the raw Response).
 */
export const extractInvokeError = async (error: unknown): Promise<string> => {
  if (!error) return "";
  const ctx: Response | undefined = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return text.slice(0, 240);
      } catch {
        /* ignore */
      }
    }
  }
  return (error as { message?: string })?.message || "";
};
