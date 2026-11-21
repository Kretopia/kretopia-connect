// Dependency-free bounded readers. The byte budget applies to the stream,
// not to a trusted Content-Length header or an already allocated string.
export const JSON_BODY_MAX = 64 * 1024;

export class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413 | 415, message: string) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readBoundedText(req: Request, maxBytes = JSON_BODY_MAX): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Invalid body limit");
  const length = req.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new RequestBodyError(400, "Invalid content length");
    if (Number(length) > maxBytes) {
      await req.body?.cancel().catch(() => undefined);
      throw new RequestBodyError(413, "Payload too large");
    }
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError(413, "Payload too large");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new RequestBodyError(400, "Invalid UTF-8");
  }
}

export async function readJsonObject(req: Request, maxBytes = JSON_BODY_MAX): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new RequestBodyError(415, "Send application/json");
  }
  const text = await readBoundedText(req, maxBytes);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new RequestBodyError(400, "Invalid JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError(400, "Send a JSON object");
  }
  return value as Record<string, unknown>;
}