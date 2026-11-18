/** Old search links resolve to Scout, preserving the original text. */
export function genericSearchTarget(search: string): string {
  const params = new URLSearchParams(search);
  if ((params.get("q") ?? "").trim() !== "") return `/scout?q=${encodeURIComponent(params.get("q") || "")}`;
  return "/scout";
}
