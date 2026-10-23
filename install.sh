#!/usr/bin/env bash
#
# ui-skill - install the ui-motion agent skill.
#
#   ./install.sh                          # claude + qoder, user scope
#   ./install.sh --target cursor --project
#   ./install.sh --all --link
#   curl -fsSL https://raw.githubusercontent.com/Whalerr09/UI-skill/main/install.sh | bash
#
# Node is optional. With Node the full installer runs (every target, distilled
# rules files, doctor). Without Node this script copies the skill folder into
# ~/.claude/skills and ~/.qoder/skills directly.
#
set -euo pipefail

REPO_URL="https://github.com/Whalerr09/UI-skill.git"
REPO_ZIP="https://codeload.github.com/Whalerr09/UI-skill/zip/refs/heads/main"
SKILL_NAME="ui-motion"

TARGETS=()
MODE="install"
ALL=0
PROJECT=0
LINK=0
FORCE=0
DEST=""

color() {
  if [ -t 1 ]; then printf '\033[%sm%s\033[0m' "$1" "$2"; else printf '%s' "$2"; fi
}
step() { printf '  %s\n' "$1"; }
ok()   { printf '  %s %s\n' "$(color 32 '+')" "$1"; }
warn() { printf '  %s %s\n' "$(color 33 '!')" "$1"; }
fail() { printf '  %s %s\n' "$(color 31 'x')" "$1"; }

usage() {
  cat <<'EOF'

  ui-motion - agent skill installer

  Usage
    ./install.sh [options]

  Options
    -t, --target <name>   Agent to install for (repeatable): claude, qoder,
                          cursor, windsurf, copilot, agents. Default: claude, qoder
        --all             Every known target
        --project         Install into the current repo instead of $HOME
        --link            Symlink the source folder instead of copying
    -f, --force           Replace an existing install
        --dest <path>     Custom directory (single target only)
        --uninstall       Remove an installed copy
        --list            Show supported targets
        --doctor          Check the payload and report installed copies
    -h, --help            This message

  Examples
    ./install.sh
    ./install.sh --target cursor --project
    ./install.sh --all --link

EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -t|--target) TARGETS+=("${2:?--target needs a value}"); shift 2 ;;
    --target=*) TARGETS+=("${1#*=}"); shift ;;
    --all) ALL=1; shift ;;
    --project) PROJECT=1; shift ;;
    --link) LINK=1; shift ;;
    -f|--force) FORCE=1; shift ;;
    --dest) DEST="${2:?--dest needs a value}"; shift 2 ;;
    --dest=*) DEST="${1#*=}"; shift ;;
    --uninstall|--remove) MODE="uninstall"; shift ;;
    --list|--targets) MODE="list"; shift ;;
    --doctor|--check) MODE="doctor"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown option: $1"; usage; exit 1 ;;
  esac
done

printf '\n  %s  %s\n\n' "$(color 1 'ui-motion')" "$(color 2 'agent skill installer')"

# -------------------------------------------------------------- locate payload
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"

if [ -z "${ROOT:-}" ] || [ ! -f "$ROOT/SKILL.md" ]; then
  # Running from `curl | bash`: fetch a copy to a temp dir.
  ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ui-skill.XXXXXX")"
  step "Fetching skill into $ROOT"

  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 --quiet "$REPO_URL" "$ROOT"
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL "$REPO_ZIP" -o "$ROOT.zip"
    command -v unzip >/dev/null 2>&1 || { fail "unzip is required"; exit 1; }
    unzip -q "$ROOT.zip" -d "$ROOT"
    inner="$(find "$ROOT" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
    [ -n "$inner" ] && ROOT="$inner"
  else
    fail "git or curl is required to fetch the skill"
    exit 1
  fi
fi

if [ ! -f "$ROOT/SKILL.md" ]; then
  fail "SKILL.md not found. Run install.sh from the repository root."
  exit 1
fi

ok "using $ROOT"

# -------------------------------------------------------------------- delegate
if command -v node >/dev/null 2>&1 && [ -f "$ROOT/bin/ui-skill.mjs" ]; then
  args=("$ROOT/bin/ui-skill.mjs" "$MODE")
  for name in "${TARGETS[@]:-}"; do [ -n "$name" ] && args+=(--target "$name"); done
  [ "$ALL" -eq 1 ] && args+=(--all)
  [ "$PROJECT" -eq 1 ] && args+=(--project)
  [ "$LINK" -eq 1 ] && args+=(--link)
  [ "$FORCE" -eq 1 ] && args+=(--force)
  [ -n "$DEST" ] && args+=(--dest "$DEST")
  exec node "${args[@]}"
fi

# --------------------------------------------------------- no-node fallback path
if [ "$MODE" != "install" ]; then
  fail "Node 18+ is required for --$MODE. https://nodejs.org"
  exit 1
fi

warn "Node not found - falling back to a plain folder copy (claude, qoder)."
step "Install Node 18+ for every target: https://nodejs.org"

if [ "$ALL" -eq 1 ] || [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=(claude qoder)
fi

for name in "${TARGETS[@]}"; do
  case "$name" in
    claude) base="$HOME/.claude/skills" ;;
    qoder)  base="$HOME/.qoder/skills" ;;
    *) warn "$name needs Node (single-file rules target) - skipped"; continue ;;
  esac

  if [ "$PROJECT" -eq 1 ]; then
    base="./.${name}/skills"
  fi

  dest="$base/$SKILL_NAME"

  if [ -e "$dest" ] && [ "$FORCE" -ne 1 ]; then
    warn "$name already installed at $dest (use --force to replace)"
    continue
  fi

  rm -rf "$dest"
  mkdir -p "$dest"
  for entry in SKILL.md references assets; do
    [ -e "$ROOT/$entry" ] || continue
    cp -R "$ROOT/$entry" "$dest/"
  done
  ok "$name -> $dest"
done

printf '\n'
step 'Next: open your agent and ask for a landing page.'
step '  "Build a landing page for my product with motion level 2."'
step 'Docs: https://github.com/Whalerr09/UI-skill'
printf '\n'
