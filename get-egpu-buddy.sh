#!/bin/bash
# SteamOS EGPU Buddy one-line installer:
#   curl -fsSL https://raw.githubusercontent.com/denver8989/EGPU-Buddy/master/get-egpu-buddy.sh | bash
# Fetches the latest release, verifies its SHA-256, installs Decky Loader with its official installer if it is missing
# (EGPU_NO_DECKY=1 skips it), then runs the EGPU Buddy installer (graphical if a display is available, otherwise in this
# terminal), which installs everything: the integration, the Game Mode plugin and the desktop app.
set -euo pipefail
REPO=denver8989/EGPU-Buddy
say(){ printf '\033[1m%s\033[0m\n' "$*"; }
ask(){ read -rp "$1 [y/N] " r </dev/tty; [ "${r,,}" = y ]; }
[ "$(id -u)" = 0 ] && { echo "run this as your normal user (sudo is asked for when needed)"; exit 1; }
command -v curl >/dev/null || { echo "curl is required"; exit 1; }
if [ "$(passwd -S "$USER" 2>/dev/null | awk '{print $2}')" != P ]; then
  say "== your account has no password (SteamOS default); sudo needs one. Set it now (typed twice, nothing is shown):"
  passwd </dev/tty; [ "$(passwd -S "$USER" 2>/dev/null | awk '{print $2}')" = P ] || { echo "no password set; cannot continue"; exit 1; }
fi
say "== SteamOS EGPU Buddy: looking up the latest release"
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
[ -n "$TAG" ] || { echo "could not determine the latest release"; exit 1; }
VER=${TAG#v}; NAME="SteamOS-EGPU-Buddy-$VER.run"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
say "== downloading $NAME"
curl -fSL --progress-bar -o "$T/$NAME" "https://github.com/$REPO/releases/download/$TAG/$NAME"
curl -fsSL -o "$T/SHA256SUMS" "https://github.com/$REPO/releases/download/$TAG/SHA256SUMS"
WANT=$(awk -v n="$NAME" '$2 ~ ("(^|/)" n "$") {print $1; exit}' "$T/SHA256SUMS"); GOT=$(sha256sum "$T/$NAME" | cut -d" " -f1)
[ -n "$WANT" ] && [ "$WANT" = "$GOT" ] && say "== checksum ok" || { echo "checksum mismatch, aborting"; exit 1; }
chmod +x "$T/$NAME"
# Everything is installed: Decky Loader too when it is missing (its official installer; the EGPU Buddy Game Mode plugin
# needs it), unless EGPU_NO_DECKY=1. The installer below then puts the plugin in, with every other component.
if [ ! -d "$HOME/homebrew/plugins" ] && [ "${EGPU_NO_DECKY:-0}" != 1 ]; then
  say "== installing Decky Loader with its official installer (github.com/SteamDeckHomebrew/decky-installer), for the Game Mode plugin"
  curl -fsSL https://github.com/SteamDeckHomebrew/decky-installer/releases/latest/download/install_release.sh | sh </dev/tty \
    || echo "the Decky Loader installer returned an error"
  [ -d "$HOME/homebrew/plugins" ] && say "== Decky Loader installed" \
    || echo "note: Decky Loader is not installed; EGPU Buddy is installed without its Game Mode plugin (install Decky Loader and run this again to add it)"
fi
[ "${EGPU_BOOTSTRAP_DRYRUN:-0}" = 1 ] && { say "== dry run: would now run $NAME"; exit 0; }
say "== running the installer"
"$T/$NAME" "$@" </dev/tty
