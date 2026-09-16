/**
 * Masks a full name for unauthenticated users.
 * Shows first name + last initial (e.g., "John D.")
 */
export function maskCreatorName(fullName: string | null | undefined, isAuthenticated: boolean): string {
  if (!fullName) return "Creator";
  if (isAuthenticated) return fullName;
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return `${parts[0][0]}***`;
  
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
