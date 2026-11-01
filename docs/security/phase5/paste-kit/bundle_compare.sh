#!/usr/bin/env bash
# Compare the files of lot 4 (and everything they import) with YOUR project, in one run. No git repository needed.
# It changes nothing in your project: it writes only under ./out next to this script.
#   bash <this folder>/compare.sh [project_root]        (project_root defaults to the current directory)
# Statuses: MISSING, SAME_AS_MAIN (already the new version), SAME_AS_BASE (not ahead of the repository: safe to overwrite),
#           DIFFERENT (your file has changes the repository does not: a merge candidate is written to out/merged/).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$(cd "${1:-.}" && pwd)"
out="$here/out"; rm -rf "$out"; mkdir -p "$out/merged" "$out/production"; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
norm() { python3 -c 'import sys; d = sys.stdin.buffer.read().replace(b"\r\n", b"\n"); sys.stdout.buffer.write(d if (d.endswith(b"\n") or not d) else d + b"\n")'; }
sha() { shasum -a 256 < "$1" | cut -c1-12; }
report="$out/report.txt"
{ echo "project: $root"; echo "project_id in supabase/config.toml: $(grep -E '^[[:space:]]*project_id' "$root/supabase/config.toml" 2>/dev/null | head -1 | sed 's/.*=//; s/[ "]//g')"; echo "files in supabase/functions/_shared: $(ls "$root/supabase/functions/_shared" 2>/dev/null | wc -l | tr -d ' ')"; echo; printf "%-58s %-11s %-13s %s\n" FILE ROLE STATUS DETAIL; } > "$report"
while IFS='|' read -r path role; do
  [ -n "$path" ] || continue
  f="$root/$path"; base="$here/base/$path"; mine="$here/mine/$path"; status=""; detail=""
  norm < "$mine" > "$tmp/mine"; has_base=0; if [ -f "$base" ]; then norm < "$base" > "$tmp/base"; has_base=1; fi
  if [ ! -f "$f" ]; then status="MISSING"; detail="not in the project"
  else
    norm < "$f" > "$tmp/prod"
    if cmp -s "$tmp/prod" "$tmp/mine"; then status="SAME_AS_MAIN"; detail="$(wc -l < "$tmp/prod" | tr -d ' ') lines"
    elif [ "$has_base" = 1 ] && cmp -s "$tmp/prod" "$tmp/base"; then status="SAME_AS_BASE"; detail="$(wc -l < "$tmp/prod" | tr -d ' ') lines; safe to overwrite"
    else
      status="DIFFERENT"; mkdir -p "$out/production/$(dirname "$path")"; cp "$tmp/prod" "$out/production/$path"
      if [ "$has_base" = 1 ] && ! cmp -s "$tmp/base" "$tmp/mine"; then
        mkdir -p "$out/merged/$(dirname "$path")"; cp "$tmp/prod" "$tmp/cur"
        git merge-file -p -L production -L baseline -L main "$tmp/cur" "$tmp/base" "$tmp/mine" > "$out/merged/$path" 2>/dev/null; rc=$?
        if [ "$rc" -eq 0 ]; then detail="production $(wc -l < "$tmp/prod" | tr -d ' ') lines vs main $(wc -l < "$tmp/mine" | tr -d ' '); merge clean -> out/merged/$path"
        elif [ "$rc" -gt 0 ]; then detail="merge: $rc conflict(s) -> out/merged/$path (markers)"; else detail="merge could not run"; fi
      elif [ "$has_base" = 1 ]; then detail="not changed by lot 4; your copy differs from the repository's (informational)"
      else detail="no baseline (new file in the repository); your project has a file of that name"; fi
    fi
  fi
  printf "%-58s %-11s %-13s %s\n" "${path#supabase/functions/}" "$role" "$status" "$detail" >> "$report"
  # the names the batch imports from this file must be exported in your copy
  if [ -f "$f" ]; then
    needs="$(awk -F'|' -v p="$path" '$1 == p { print $2 }' "$here/needs.txt" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
    if [ -n "${needs// /}" ]; then missing=""; for n in $needs; do
      grep -Eq "export[^;{]*[[:space:]]${n}([^A-Za-z0-9_]|\$)|export[[:space:]]*\{[^}]*\b${n}\b" "$tmp/prod" 2>/dev/null || missing="$missing $n"; done
      [ -z "$missing" ] || printf "%-58s %-11s %-13s %s\n" "  ^ exports" "" "MISSING" "names the batch imports but your copy does not export:$missing" >> "$report"
    fi
  fi
done < "$here/manifest.txt"
cat "$report"
