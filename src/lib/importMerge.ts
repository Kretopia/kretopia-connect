export const IMPORTABLE_PROFILE_FIELDS = ["full_name", "role", "bio", "location"] as const;
export type ImportableProfileField = (typeof IMPORTABLE_PROFILE_FIELDS)[number];

/**
 * What an import may change. Imported text fills a field only when the member has nothing there; a field they already wrote
 * is kept as it is and reported, never replaced. Imported claims are suggestions: the caller puts `fill` into the edit form,
 * and nothing is saved until the member presses Save.
 */
export function planProfileImport(
  current: Partial<Record<ImportableProfileField, unknown>>,
  incoming: Partial<Record<ImportableProfileField, unknown>>,
): { fill: Partial<Record<ImportableProfileField, string>>; kept: ImportableProfileField[] } {
  const fill: Partial<Record<ImportableProfileField, string>> = {};
  const kept: ImportableProfileField[] = [];
  for (const field of IMPORTABLE_PROFILE_FIELDS) {
    const value = typeof incoming[field] === "string" ? (incoming[field] as string).trim() : "";
    if (!value) continue;
    if (String(current[field] ?? "").trim()) kept.push(field);
    else fill[field] = value;
  }
  return { fill, kept };
}
