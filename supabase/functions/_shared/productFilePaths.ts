// Pure, dependency-free rule for "may the service role sign this product file
// path". Imported by edge functions (Deno) and by tests (Vite).
//
// Why: a seller writes `digital_products.file_urls` themselves (the row's UPDATE
// policy is `auth.uid() = user_id`) and every active product is publicly
// selectable, so anyone can read another seller's file paths. The delivery
// functions sign whatever path the row names with the service role, which can
// read the whole private `product-files` bucket. Without a check, a seller could
// list a victim's path in their own cheap product, buy it, and be handed a
// signed URL to the victim's paid file.
//
// Rule: the private bucket's own upload policy puts a seller's files under
// `<seller user id>/...`, so a path is deliverable for a product only when its
// first segment is that product's seller. Anything else (another seller's
// folder, an absolute path, a traversal segment, a non-string) is refused and
// never signed. Absolute http(s) URLs are legacy data that the delivery
// functions pass through unsigned; they stay as they were.

export type ProductFileKind = "owned" | "external" | "foreign";

export function classifyProductFile(entry: unknown, sellerId: unknown): ProductFileKind {
  if (typeof entry !== "string" || entry.length === 0) return "foreign";
  if (/^https?:\/\//i.test(entry)) return "external";
  if (typeof sellerId !== "string" || sellerId.length === 0) return "foreign";
  if (entry.startsWith("/") || entry.includes("\\") || entry.includes("\0")) return "foreign";
  const segments = entry.split("/");
  if (segments.length < 2) return "foreign";
  if (segments.some((s) => s === "" || s === "." || s === "..")) return "foreign";
  return segments[0] === sellerId ? "owned" : "foreign";
}

/** The entries a delivery function may hand out or sign, in their original order. */
export function deliverableProductFiles(entries: unknown, sellerId: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e): e is string => classifyProductFile(e, sellerId) !== "foreign");
}
