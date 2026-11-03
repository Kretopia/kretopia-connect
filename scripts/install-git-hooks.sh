#!/bin/sh
# Installs, checks or removes the repository's git guards (scripts/git-hooks/) for this clone and every worktree of it.
#
#   sh scripts/install-git-hooks.sh              install
#   sh scripts/install-git-hooks.sh --check      say whether they are installed (exit 1 when not)
#   sh scripts/install-git-hooks.sh --uninstall  remove them and put back whatever hooks were there before
#
# A clone keeps one hooks directory, shared by all its worktrees. A small shim goes there for each guarded hook. At run time the shim
# executes the guard from the working tree the command runs in (a checkout or branch without scripts/git-hooks has nothing to run and is
# let through), then the hook that was installed before it, kept as <hook>.before-kretopia-guard, with the same arguments and standard
# input. core.hooksPath is never set: it would replace the existing hooks instead of adding to them.
set -eu

HOOKS="pre-commit pre-push"
MARKER="kretopia-guard-shim"
KEPT=".before-kretopia-guard"

mode=install
case "${1:-}" in
  "") ;;
  --check) mode=check ;;
  --uninstall) mode=uninstall ;;
  *) echo "usage: sh scripts/install-git-hooks.sh [--check|--uninstall]" >&2; exit 2 ;;
esac

top=$(git rev-parse --show-toplevel)
cd "$top"
dir=$(git rev-parse --git-path hooks)
case "$dir" in /*) ;; *) dir="$top/$dir" ;; esac

if [ "$mode" != uninstall ] && [ -n "$(git config --get core.hooksPath || true)" ]; then
  echo "core.hooksPath is set ($(git config --get core.hooksPath)): git ignores $dir, so a hook installed there would never run." >&2
  exit 1
fi

# The shim for one hook. pre-push receives the refs on standard input, which two programs (the guard, then the previous hook) must both
# read, so it is kept in a file; pre-commit receives nothing.
shim_text() {
  hook=$1
  cat <<EOF
#!/bin/sh
# $MARKER -- written by scripts/install-git-hooks.sh; remove it with: sh scripts/install-git-hooks.sh --uninstall
# Runs the repository's guard for $hook from the working tree this command runs in, then the hook that was installed before this one.
EOF
  if [ "$hook" = pre-push ]; then
    cat <<'EOF'
input=$(mktemp "${TMPDIR:-/tmp}/kretopia-hook.XXXXXX") || exit 1
trap 'rm -f "$input"' EXIT
cat > "$input"
EOF
  else
    echo 'input=/dev/null'
  fi
  cat <<EOF
top=\$(git rev-parse --show-toplevel 2>/dev/null) || top=
guard="\$top/scripts/git-hooks/$hook"
if [ -n "\$top" ] && [ -x "\$guard" ]; then
  "\$guard" "\$@" < "\$input" || exit \$?
fi
previous="\$(dirname "\$0")/$hook$KEPT"
if [ -x "\$previous" ]; then
  "\$previous" "\$@" < "\$input" || exit \$?
fi
exit 0
EOF
}

install_hook() {
  target="$dir/$1"
  if [ -e "$target" ] && ! grep -q "$MARKER" "$target"; then
    if [ -e "$target$KEPT" ]; then
      echo "$target$KEPT already exists next to a hook that is not ours: move one of them away and run this again." >&2
      exit 1
    fi
    mv "$target" "$target$KEPT"
    echo "  $1: kept the existing hook as $1$KEPT (it still runs after the guard)"
  fi
  shim_text "$1" > "$target"
  chmod +x "$target"
  echo "  $1: installed"
}

uninstall_hook() {
  target="$dir/$1"
  if [ -e "$target" ] && grep -q "$MARKER" "$target"; then
    rm -f "$target"
    if [ -e "$target$KEPT" ]; then
      mv "$target$KEPT" "$target"
      echo "  $1: removed, the previous hook is back"
    else
      echo "  $1: removed"
    fi
  else
    echo "  $1: not installed"
  fi
}

missing=0
check_hook() {
  if [ -x "$dir/$1" ] && grep -q "$MARKER" "$dir/$1"; then
    echo "  $1: installed"
  else
    echo "  $1: NOT installed"
    missing=1
  fi
}

mkdir -p "$dir"
echo "git guards, hooks directory: $dir"
for hook in $HOOKS; do
  case "$mode" in
    install) install_hook "$hook" ;;
    uninstall) uninstall_hook "$hook" ;;
    check) check_hook "$hook" ;;
  esac
done

if [ "$mode" = install ]; then
  echo "Done. They guard every worktree of this clone. They are a safety net, not a lock: --no-verify skips them (see scripts/git-hooks/README.md)."
fi
exit $missing
