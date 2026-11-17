/** Local official identity assets also work in the editor's asset-free preview. */
export function MatchBrand({ iconOnly = false }: { iconOnly?: boolean }) {
  return <span className="flex shrink-0 items-center gap-2">
    <img src="/brand/kretopia-identity/mark/kretopia-mark-transparent.webp" alt="Kretopia" className="h-7 w-7 object-contain" />
    {!iconOnly ? <span className="text-lg font-bold text-foreground">kretopia</span> : null}
  </span>;
}