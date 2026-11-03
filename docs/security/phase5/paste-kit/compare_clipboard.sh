#!/usr/bin/env bash
# Compare ONE file as it is in the production project (kretopia-app: a Lovable project, not a GitHub repository) with the version this branch
# started from and the one it changes it to.
# Read-only: it writes nothing but temporary files and, only when production differs from both versions, a three-way merge candidate under
# docs/security/phase5/paste-kit/{production,merged}/ (git-ignored). Run it from the repository root.
#   1. in the kretopia-app code view open the file, select all, copy
#   2. bash docs/security/phase5/paste-kit/compare_clipboard.sh supabase/functions/_shared/ssrf.ts
# (the content can also be piped in:  pbpaste | bash docs/security/phase5/paste-kit/compare_clipboard.sh <path>)
#
# Exit 0: compared. Exit 2: NOT compared, because the input is not the file (empty, Markdown, not a module, or another file). A refusal never
# prints "identical", "baseline" or "DIFFERENT": a verdict on the wrong text is worse than none. It also deletes the candidate files of any
# earlier run for this path first, so a stale candidate cannot be mistaken for this run's.
#   COMPARE_BASE=<commit>      the baseline (default c0da3818e, the commit the batch started from)
#   COMPARE_SKIP_IDENTITY=1    skip the "is it this file" similarity check, when production really rewrote the file
set -euo pipefail
path="${1:?usage: compare_clipboard.sh <path of the file in the repository>}"
BASE="${COMPARE_BASE:-c0da3818e}"
out="docs/security/phase5/paste-kit"
norm() { python3 -c 'import sys; d = sys.stdin.buffer.read().replace(b"\r\n", b"\n"); sys.stdout.buffer.write(d if (d.endswith(b"\n") or not d) else d + b"\n")'; }
refuse() { echo "REFUSED: $1"; shift; for line in "$@"; do echo "  $line"; done; echo "  Nothing was compared and nothing was written."; exit 2; }

case "$path" in
  "" | /* | *..*) refuse "$path is not a path inside this repository." ;;
esac
[ -f "$path" ] || refuse "$path does not exist in this working tree." "Run this from the repository root, on the branch that holds the file."
rm -f "$out/production/$path" "$out/merged/$path"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
if [ -t 0 ]; then pbpaste | norm > "$tmp/prod"; else norm > "$tmp/prod"; fi
[ -s "$tmp/prod" ] || refuse "the clipboard is empty." "Copy the file from the kretopia-app code view first."
norm < "$path" > "$tmp/head"
have_base=0; : > "$tmp/base"
if git show "$BASE:$path" 2>/dev/null | norm > "$tmp/base" && [ -s "$tmp/base" ]; then have_base=1; fi

# Is the input THIS file? Three tests, any failure refuses: it is not Markdown; it has an import, an export or the file's own first line;
# and it shares at least 15% of its meaningful lines with the repository's version (the branch's or the baseline's: a production copy can be
# behind or ahead, an unrelated module shares almost nothing). Files with fewer than 8 meaningful lines are judged by the first two tests.
cat > "$tmp/identity.py" <<'PY'
import re, sys
prod_p, head_p, base_p, skip = sys.argv[1:5]
def read(p):
    try:
        return open(p, encoding="utf-8", errors="replace").read()
    except OSError:
        return ""
prod, head, base = read(prod_p), read(head_p), read(base_p)
lines = lambda t: [l.strip() for l in t.splitlines()]
first = lambda t: next((l for l in lines(t) if l), "")
meaningful = lambda t: {l for l in lines(t) if len(l) >= 12 and re.search(r"[A-Za-z0-9]", l)}
why = []
headers = [h for h in (first(head), first(base)) if h]
if re.search(r"^(#+ |\| ?-{3})", prod, re.M):
    why.append("it looks like Markdown (a heading or a table), not TypeScript")
elif not (re.search(r"^\s*(import|export)\b", prod, re.M) or any(h in lines(prod) for h in headers)):
    why.append("it has no import, no export and not this file's own first line (" + (headers[0][:60] if headers else "no header") + ")")
if skip != "1" and not why:
    best, of = 0.0, ""
    for name, text in (("this branch's version", head), ("the baseline's version", base)):
        ref = meaningful(text)
        if len(ref) >= 8:
            share = len(ref & meaningful(prod)) / len(ref)
            if share > best or not of:
                best, of = share, name
    if of and best < 0.15:
        why.append("it shares only %d%% of its lines with %s of this file: it is another file, or only part of this one" % (round(best * 100), of))
for w in why:
    print("reason: " + w)
sys.exit(1 if why else 0)
PY
if ! why="$(python3 "$tmp/identity.py" "$tmp/prod" "$tmp/head" "$tmp/base" "${COMPARE_SKIP_IDENTITY:-0}")"; then
  refuse "what is on the clipboard is not $path." "$why" "It starts with: $(head -n 1 "$tmp/prod" | cut -c1-80)" \
    "Open the file in the kretopia-app code view (not this repository, not the kit), click inside the editor, select all, copy, and run this again." \
    "If it really is that file and production rewrote it, run again with COMPARE_SKIP_IDENTITY=1."
fi

echo "comparing $path (baseline $BASE)"
echo "production copy: $(wc -l < "$tmp/prod" | tr -d ' ') lines, sha256 $(shasum -a 256 < "$tmp/prod" | cut -c1-12)"
echo "this branch:     $(wc -l < "$tmp/head" | tr -d ' ') lines, sha256 $(shasum -a 256 < "$tmp/head" | cut -c1-12)"
if [ "$have_base" = 1 ]; then echo "baseline:        $(wc -l < "$tmp/base" | tr -d ' ') lines, sha256 $(shasum -a 256 < "$tmp/base" | cut -c1-12)"; fi
if cmp -s "$tmp/prod" "$tmp/head"; then
  echo "RESULT: identical to this branch. It is already pasted."
elif [ "$have_base" = 1 ] && cmp -s "$tmp/prod" "$tmp/base"; then
  echo "RESULT: identical to the baseline ($BASE), the version this branch started from. Production is not ahead of the repository: safe to overwrite."
else
  echo "RESULT: DIFFERENT from this branch$( [ "$have_base" = 1 ] && echo ' and from the baseline'). Do NOT overwrite: production has changes this branch does not."
  if [ "$have_base" = 1 ]; then
    diff -u "$tmp/base" "$tmp/prod" | head -40 || true
    # Never overwrite: keep what production added and apply what this branch changes (a three-way merge, baseline as the common ancestor).
    mkdir -p "$out/production/$(dirname "$path")" "$out/merged/$(dirname "$path")"
    cp "$tmp/prod" "$out/production/$path"; cp "$tmp/prod" "$tmp/cur"
    set +e; git merge-file -p -L production -L baseline -L this-branch "$tmp/cur" "$tmp/base" "$tmp/head" > "$out/merged/$path"; rc=$?; set -e
    if [ "$rc" -eq 0 ]; then echo "MERGE: clean. Production's own changes are kept and this branch's changes applied. Candidate: $out/merged/$path (production copy saved in $out/production/$path). Tell me; paste the candidate only after I have reviewed it."
    elif [ "$rc" -gt 0 ]; then echo "MERGE: $rc conflict(s). Written with markers to $out/merged/$path. Tell me and do not paste anything."
    else echo "MERGE: could not run (git merge-file failed). The production copy is saved in $out/production/$path; tell me."; fi
  else echo "(this file is new in the branch: production has a file of that name that the repository does not know)"; fi
fi
needs="$(awk -F'|' -v p="$path" '$1 == p { print $2 }' <<'TABLE'
supabase/functions/_shared/agentActionBinding.ts|bindApprovedAction
supabase/functions/_shared/agentAuthority.ts|authorizeHighStakesAction recordExecutedAction
supabase/functions/_shared/aiLimits.ts|TOKENS_SHORT_LABEL
supabase/functions/_shared/aiModels.ts|GEMINI_3_FLASH GEMINI_FLASH GEMINI_FLASH_IMAGE GEMINI_FLASH_LITE
supabase/functions/_shared/aiRateLimit.ts|checkAiFeatureRateLimit
supabase/functions/_shared/fetchWithTimeout.ts|fetchWithTimeout
supabase/functions/_shared/guard.ts|GuardError constantTimeEqual corsFor rateLimit readJson requireUser safeError
supabase/functions/_shared/notificationGuards.ts|INVOICE_CHASE_COOLDOWN_MS cooldownCutoffIso decideInvoiceChase
supabase/functions/_shared/outboundText.ts|cleanRecipientEmail escapeHtmlText singleLine
supabase/functions/_shared/promptIsolation.ts|PROMPT_INJECTION_DEFENSE_CLAUSE wrapUntrustedContent
supabase/functions/_shared/aiModels.ts|GEMINI_3_FLASH
supabase/functions/_shared/copilotContext.ts|loadCopilotContext renderContextPreamble
supabase/functions/_shared/executionGuard.ts|evaluateExecutionGuard
supabase/functions/_shared/fetchWithTimeout.ts|fetchWithTimeout
supabase/functions/_shared/guard.ts|corsFor readJson safeError
TABLE
)"
needs="$(tr ' ' '\n' <<<"$needs" | sort -u | tr '\n' ' ')"
if [ -n "${needs// /}" ]; then
  missing=""; for n in $needs; do
    grep -Eq "export[^;{]*[[:space:]]${n}([^A-Za-z0-9_]|\$)|export[[:space:]]*\{[^}]*\b${n}\b" "$tmp/prod" || missing="$missing $n"; done
  if [ -z "$missing" ]; then echo "EXPORTS: the batch imports $(wc -w <<<"$needs" | tr -d ' ') name(s) from this file and all appear exported in the production copy."
  else echo "EXPORTS MISSING in the production copy:$missing  -> the functions that import them would fail to start. Do not paste them yet."; fi
fi
