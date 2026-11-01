#!/usr/bin/env bash
# Compare ONE file as it is in the production project (kretopia-app) with the version this branch started from and the one it changes it to.
# Read-only: it writes nothing but temporary files. Run it from the repository root.
#   1. in the kretopia-app code view open the file, select all, copy
#   2. bash docs/security/phase5/paste-kit/compare_clipboard.sh supabase/functions/_shared/ssrf.ts
# (the content can also be piped in:  pbpaste | bash docs/security/phase5/paste-kit/compare_clipboard.sh <path>)
set -euo pipefail
path="${1:?usage: compare_clipboard.sh <path of the file in the repository>}"
BASE=c0da3818e
norm() { python3 -c 'import sys; d = sys.stdin.buffer.read().replace(b"\r\n", b"\n"); sys.stdout.buffer.write(d if (d.endswith(b"\n") or not d) else d + b"\n")'; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
if [ -t 0 ]; then pbpaste | norm > "$tmp/prod"; else norm > "$tmp/prod"; fi
[ -s "$tmp/prod" ] || { echo "The clipboard is empty: copy the file from kretopia-app first."; exit 2; }
if ! grep -Eq '^[[:space:]]*(import|export|declare|const|let|function|async|type|interface|//|/\*)' "$tmp/prod" || grep -Eq '^(#+ |\| ---)' "$tmp/prod"; then
  echo "The clipboard does not look like a TypeScript file. It starts with: $(head -n 1 "$tmp/prod" | cut -c1-80)"
  echo "Open the file in the kretopia-app code view (not this repository, not the kit), click inside the editor, select all, copy, and run this again."
  exit 2
fi
norm < "$path" > "$tmp/head"
have_base=0; if git show "$BASE:$path" 2>/dev/null | norm > "$tmp/base" && [ -s "$tmp/base" ]; then have_base=1; fi
echo "production copy: $(wc -l < "$tmp/prod" | tr -d ' ') lines, sha256 $(shasum -a 256 < "$tmp/prod" | cut -c1-12)"
echo "this branch:     $(wc -l < "$tmp/head" | tr -d ' ') lines, sha256 $(shasum -a 256 < "$tmp/head" | cut -c1-12)"
if cmp -s "$tmp/prod" "$tmp/head"; then
  echo "RESULT: identical to this branch. It is already pasted."
elif [ "$have_base" = 1 ] && cmp -s "$tmp/prod" "$tmp/base"; then
  echo "RESULT: identical to the baseline ($BASE), the version this branch started from. Production is not ahead of the repository: safe to overwrite."
else
  echo "RESULT: DIFFERENT from this branch$( [ "$have_base" = 1 ] && echo ' and from the baseline'). Do not overwrite yet: send the diff below."
  if [ "$have_base" = 1 ]; then diff -u "$tmp/base" "$tmp/prod" | head -60 || true; else echo "(this file is new in the branch: production has a file of that name that the repository does not know)"; fi
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
