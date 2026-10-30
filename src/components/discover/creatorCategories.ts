import { getRoleStampCategory, ROLE_STAMP_LABEL, type RoleStampCategory } from "@/lib/passport/roleStamp";

/** Presentation only: preserve every ranked result and its order within its craft. */
export function groupCreatorsByCraft<T extends { role?: string | null; sub_roles?: string[] | null }>(creators: T[]) {
  const groups = new Map<RoleStampCategory, { id: RoleStampCategory; label: string; creators: T[] }>();
  for (const creator of creators) {
    const id = getRoleStampCategory(creator);
    let group = groups.get(id);
    if (!group) { group = { id, label: ROLE_STAMP_LABEL[id], creators: [] }; groups.set(id, group); }
    group.creators.push(creator);
  }
  return [...groups.values()];
}