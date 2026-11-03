/**
 * True for an address inside this app ("/x?y=1"). Never another origin, a protocol-relative address ("//host"), a backslash form browsers
 * read as one ("/\host"), or anything carrying a scheme. Used wherever an address travels through state or a query string and is later
 * navigated to.
 */
export function isInAppPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.includes("://");
}
