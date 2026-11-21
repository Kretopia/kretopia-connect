import { readBoundedText, RequestBodyError } from "./requestBody.ts";

/** Public read-only routes remain public; methods are rejected before effects. */
export async function publicReadBoundary(req: Request, cors: Record<string, string>, allowPost = false): Promise<Response | null> {
  const methods = allowPost ? ["GET", "HEAD", "POST", "OPTIONS"] : ["GET", "HEAD", "OPTIONS"];
  const headers = { ...cors, Allow: methods.join(", "), "Access-Control-Allow-Methods": methods.join(", "), "Cache-Control": "no-store" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (!methods.includes(req.method)) return new Response("Method not allowed", { status: 405, headers });
  if (req.url.length > 8192) return new Response("URL too long", { status: 414, headers });
  if (req.body) {
    try { await readBoundedText(req); } catch (error) {
      return new Response("Invalid request body", { status: error instanceof RequestBodyError ? error.status : 400, headers });
    }
  }
  return null;
}

export const publicUuid = (value: string | null): value is string => !!value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const publicSlug = (value: string | null): value is string => !!value && value.length <= 200 && !Array.from(value).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);