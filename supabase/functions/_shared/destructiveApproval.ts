// Until the transactional effect+approval RPC is installed and independently
// tested, all destructive paths must remain blocked, including human UI calls.
export const DESTRUCTIVE_TOOLS = new Set(["delete_project", "remove_collaborator"]);
export function destructiveBlocked(toolName: string): boolean { return DESTRUCTIVE_TOOLS.has(toolName); }

export function sameApprovedArgs(saved: unknown, submitted: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  };
  return canonical(saved) === canonical(submitted);
}