import { StorageMeter } from "@/components/storage/StorageMeter";

/**
 * @deprecated Use <StorageMeter /> directly. Kept for back-compat with SettingsTab.
 */
export function StorageUsageCard() {
  return <StorageMeter variant="card" />;
}
