/** Preserve existing database IDs while presenting the Kretopia prefix everywhere. */
export function displayPassportId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.replace(/^(?:THRIVE|THR|KRT)-?/i, "KRT-");
}