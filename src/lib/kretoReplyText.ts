/** Presentation only: retain raw protocol messages for action extraction and persistence. */
export function kretoReplyText(raw: string): string {
  let text = raw.replace(/<(action|plan)>[\s\S]*?<\/\1>/gi, "");
  const protocolStart = text.search(/<(?:action|plan)\b/i);
  if (protocolStart >= 0) text = text.slice(0, protocolStart);
  text = text.replace(/!?\[([^\]]*)\]\(([^\s)]*)(?:\s+"[^"]*")?\)/g, (_, label: string, url: string) => {
    // Navigation is not an answer. Keep external-source names, never raw link syntax.
    return /^(?:\/|https?:\/\/[^/]*kretopia\.(?:com|app)\/)/i.test(url) || /^(?:open in|ouvrir dans)\b/i.test(label) ? "" : label;
  });
  // Hold incomplete links during streaming, including a label before its URL arrives.
  const unfinishedLink = text.search(/!?\[[^\]]*(?:\](?:\([^)]*)?)?$/);
  if (unfinishedLink >= 0) text = text.slice(0, unfinishedLink);
  return text
    .replace(/(?:https?:\/\/[^\s<>]*|\/(?:thrive|desk|kreto)\/[^\s<>]*)/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/\*\*|__|`{1,3}/g, "")
    .replace(/^\s*[-*]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}