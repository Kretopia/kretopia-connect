#!/usr/bin/env python3
"""Builds the transfer bundle for the project that reaches production (kretopia-app).

The agent of that project has no access to this repository, so it cannot run compare_clipboard.sh (which reads baselines with `git show`).
The bundle carries, for every file of lot 4 AND every file they import (transitively), the version the branch started from (`base/`) and the
version now in main (`mine/`), a manifest, and a repository-free script that compares them with the project's own files in one run.

Run from the repository root:  python3 docs/security/phase5/paste-kit/make_bundle.py
Output (kept local, not committed): docs/security/phase5/paste-kit/kretopia-app-bundle/ and kretopia-app-bundle.tgz
"""
import pathlib, re, shutil, subprocess, tarfile

BASE, MINE = "c0da3818e", "origin/main"
OUT = pathlib.Path("docs/security/phase5/paste-kit/kretopia-app-bundle")
FN = ["copilot-collaborator-tools", "copilot-executor", "agent-orchestrator", "send-invoice-email", "send-outreach-draft",
      "enrich-creator-profile", "enrich-press-links", "enrich-credits", "extract-event-details", "transcribe-voice-note", "send-push-notification"]
SH = ["ssrf", "aiPerimeter", "outboundBudget", "approvalHardening", "enrichmentAccess", "enrichmentCaller", "invoiceEmail", "voiceNote", "pushEndpoint"]
BATCH = [f"supabase/functions/_shared/{s}.ts" for s in SH] + [f"supabase/functions/{f}/index.ts" for f in FN]
DESK = ["supabase/functions/_shared/premiumSwitch.ts", "supabase/functions/desk-agent/index.ts"]


def show(ref, path):
    r = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True)
    return r.stdout if r.returncode == 0 else None


IMPORT = re.compile(r'(?:import|export)\s+(?!type\b)([^;]*?)\s+from\s+["\']([^"\']+)["\']', re.S)


def resolve(path, spec):
    parts = []
    for p in pathlib.PurePosixPath(str(pathlib.PurePosixPath(path).parent / spec)).parts:
        if p == "..":
            parts.pop()
        elif p != ".":
            parts.append(p)
    return "/".join(parts)


def imports(path):
    data = show(MINE, path)
    out = {}
    if data is None:
        return out
    for m in IMPORT.finditer(data.decode("utf-8", "replace")):
        if not m.group(2).startswith("."):
            continue
        braces = re.search(r"\{([^}]*)\}", m.group(1), re.S)
        names = {n.strip().split(" as ")[0].strip() for n in (braces.group(1).split(",") if braces else []) if n.strip() and not n.strip().startswith("type ")}
        out.setdefault(resolve(path, m.group(2)), set()).update(names)
    return out


def closure(seeds):
    seen, todo = set(seeds), list(seeds)
    while todo:
        for target in imports(todo.pop()):
            if target not in seen and show(MINE, target) is not None:
                seen.add(target)
                todo.append(target)
    return seen


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "base").mkdir(parents=True)
    (OUT / "mine").mkdir()
    (OUT / "docs").mkdir()
    batch_set, desk_set = set(BATCH), set(DESK)
    every = closure(BATCH + DESK)
    role = lambda p: "batch" if p in batch_set else ("desk-agent" if p in desk_set else "dependency")
    needs = {}
    for f in BATCH + DESK:
        for target, names in imports(f).items():
            if target not in batch_set and target not in desk_set:
                needs.setdefault(target, set()).update(names)
    lines = []
    for p in sorted(every, key=lambda x: ({"batch": 0, "desk-agent": 1, "dependency": 2}[role(x)], x)):
        mine, base = show(MINE, p), show(BASE, p)
        (OUT / "mine" / p).parent.mkdir(parents=True, exist_ok=True)
        (OUT / "mine" / p).write_bytes(mine)
        if base is not None:
            (OUT / "base" / p).parent.mkdir(parents=True, exist_ok=True)
            (OUT / "base" / p).write_bytes(base)
        lines.append(f"{p}|{role(p)}")
    (OUT / "manifest.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (OUT / "needs.txt").write_text("\n".join(f"{p}|{' '.join(sorted(n))}" for p, n in sorted(needs.items()) if n) + "\n", encoding="utf-8")
    for d in ("LOT4_ACTIVATION_BATCH1.md", "LOT4_PASTE_KIT.md"):
        shutil.copy(pathlib.Path("docs/security/phase5") / d, OUT / "docs" / d)
    shutil.copy("docs/security/phase5/paste-kit/bundle_compare.sh", OUT / "compare.sh")
    (OUT / "README.txt").write_text(
        "Lot 4 bundle for the project that reaches production.\n\n"
        "base/   each file as it was in the repository at " + BASE + " (the version the security work started from)\n"
        "mine/   each file as it is in the repository's main now (the security work included)\n"
        "manifest.txt  one line per file: path|role (batch = what lot 4 pastes, desk-agent = optional, dependency = imported by them, transitively)\n"
        "needs.txt     the names the batch imports from files it does not change\n"
        "compare.sh    compares them with YOUR project; it changes nothing in your project (it writes only to ./out)\n\n"
        "Run from the root of your project:   bash <this folder>/compare.sh\n"
        "Then read out/report.txt. Do not paste, deploy or run SQL because of it.\n", encoding="utf-8")
    with tarfile.open(OUT.parent / "kretopia-app-bundle.tgz", "w:gz") as tar:
        tar.add(OUT, arcname="paste-kit-bundle")
    print(f"{len(every)} files ({sum(role(p) == 'batch' for p in every)} batch, {sum(role(p) == 'desk-agent' for p in every)} desk-agent, "
          f"{sum(role(p) == 'dependency' for p in every)} dependencies); {len(needs)} files with named imports; bundle: {OUT.parent / 'kretopia-app-bundle.tgz'}")


if __name__ == "__main__":
    main()
