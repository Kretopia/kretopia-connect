# Lot 4 -- lineage check of three shared files (2026-11-03)

Question: for `_shared/ssrf.ts`, `_shared/outboundBudget.ts` and `_shared/aiPerimeter.ts`, can the repository's version be pasted over
production's without losing anything production has and the repository lacks? An earlier comparison ran on the wrong text and could not answer
it. `compare_clipboard.sh` now refuses text that is not the file (`LOT4_PASTE_KIT.md`, section A), and this is the answer with the right text.

## How the production text was obtained

Not from the clipboard. The three files were read, read-only, from the Lovable project **kretopia-app** (id `8bc8181d-6585-46a0-82d6-4570d2fbb82c`,
last edited 2026-11-02 01:52 UTC) through the Lovable connector, at the project's latest commit; the text was saved to local files and fed to
the corrected script on standard input. The `ssrf.ts` hash below is the one the owner's earlier comparison recorded (`R-LINEAGE` in
`reconciliation.json`), which also shows that the text was transferred exactly. Nothing was written to the project or to production.

What this does not show: it is the file the project holds, not proof of what the production backend is running. That is Lovable's deployment of
the project, which nothing in this repository can observe.

## Results

| File | Production | This branch | Baseline `c0da3818e` | Verdict of the script | Overwrite with this branch's version? |
|---|---|---|---|---|---|
| `_shared/outboundBudget.ts` | 194 lines, `9c2b2e75a267` | 196 lines, `e3e373eb5f4e` | 194 lines, `9c2b2e75a267` | **identical to the baseline** | Yes: production is not ahead, nothing is lost. The branch only adds `OUTREACH_GMAIL_TEMPLATE` (2 lines) |
| `_shared/ssrf.ts` | 306 lines, `d722427adc0a` | 322 lines, `35a0412c6e2c` | 302 lines, `208145094105` | **DIFFERENT from both** | **No.** Production has hardening the repository lacks; see below |
| `_shared/aiPerimeter.ts` | **absent** (the project answers 404 for that path) | 24 lines, `a257f7344b07` | 23 lines, `98e9cf42acc5` | not comparable: there is no production file | A paste creates it; nothing can be lost |

(`wc -l` gives 306 for the production `ssrf.ts`; the first report said 307.)

## `ssrf.ts`: what production has that the repository lacks

Production's copy is the baseline plus these changes, none of which is in the repository (`diff` of this branch's file against the merge candidate):

```diff
     if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
+    if (a === 192 && b === 2) return true; // documentation
+    if (a === 198 && b === 51) return true;
+    if (a === 203 && b === 0) return true;
     if (a >= 224) return true; // multicast / reserved
 ...
-  if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
+  if (/^fe[89ab][0-9a-f]:/.test(v6) || v6.startsWith("fc") || v6.startsWith("fd")) return true;
+  if (v6.startsWith("ff") || v6.startsWith("2001:db8:") || v6.startsWith("64:ff9b:1:")) return true;
```

Overwriting production with this branch's file would remove those. The reverse is also true: this branch has things production lacks (`BoundedBytes`,
`readBoundedBytes`, `requestBounded`, `safeFetchBytes`, and `safeFetchBounded` rewritten on top of them), so neither version contains the other.

Two remarks on production's additions, for the person who decides. They fail closed, so they are safe for SSRF. But the function reads only the
first two octets (`const [a, b] = v4`), so each IPv4 line blocks a whole /16 (`192.2.0.0/16`, `198.51.0.0/16`, `203.0.0.0/16`), wider than the
documentation /24s the comment names (`192.0.2.0/24` is already covered by the existing `192.0` line). And the repository's tests pass with and
without them: nothing in the repository pins these ranges.

## The merge candidate

`compare_clipboard.sh` wrote a three-way merge (production + baseline + this branch) to
`docs/security/phase5/paste-kit/merged/supabase/functions/_shared/ssrf.ts`, with production's own copy beside it in `production/`. Both folders are
git-ignored and stay on this machine. The merge is clean (no conflict markers), and the 159 tests that touch the SSRF code
(`ssrfPolicy`, `edge/ssrfConsumers`, `security/ssrfAdoption`, `discovery/pipeline`, `discovery/himalayasFeed`, `discovery/discoveryLimits`) pass with
the candidate substituted for `ssrf.ts` (a temporary vitest alias, since removed), exactly as they do with the repository's own file.

It has not been pasted anywhere, and the repository's `ssrf.ts` has not been changed. The two ways forward are the owner's to choose:
port production's ranges into the repository (then `main` holds the superset and a plain paste of `main`'s file is safe, ideally with tests that
pin the ranges), or paste the candidate into kretopia-app after reading the diff above.

## To redo it

```bash
# 1. open the file in the kretopia-app code view (not this repository), click in the editor, select all, copy
bash docs/security/phase5/paste-kit/compare_clipboard.sh supabase/functions/_shared/ssrf.ts
# REFUSED (exit 2) means the clipboard is not that file: copy again. It is never a result.
# identical to the baseline: safe to overwrite.  DIFFERENT: stop, send the diff, never overwrite.
```
