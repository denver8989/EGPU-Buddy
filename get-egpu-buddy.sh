#!/bin/bash
# EGPU Buddy one-line installer:
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
say "== EGPU Buddy: looking up the latest release"
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
[ -n "$TAG" ] || { echo "could not determine the latest release"; exit 1; }
VER=${TAG#v}; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# Already installed (by this command, the .run, or the Game Mode plugin: they all install the same files)? Then say so
# before anything is downloaded. Same version and complete: nothing to do unless a repair is wanted. Any other installed
# version: the installer below asks whether to update (or go back). Nothing is changed by this check.
INST=$(head -1 /etc/nv-egpu-buddy/version 2>/dev/null || true)
if [ -n "$INST" ] && [ "$INST" = "$VER" ] && [ -x /usr/local/sbin/nv-egpu-buddy-privileged ]; then
  say "== EGPU Buddy $INST is already installed, and it is the latest release"
  echo "   You do not need to install it again: the Game Mode plugin, the .run installer and this command all install"
  echo "   the same files, so one of them is enough. Updates are offered in the Game Mode plugin and the desktop app."
  ask "Install it again anyway (repair)?" || { echo "Nothing was changed."; exit 0; }
  export EGPU_REINSTALL_OK=1   # asked here: the installer does not ask the same question again
elif [ -n "$INST" ]; then
  say "== EGPU Buddy $INST is installed; the latest release is $VER (the installer asks before it changes anything)"
fi
curl -fsSL -o "$T/SHA256SUMS" "https://github.com/$REPO/releases/download/$TAG/SHA256SUMS"
NAME="EGPU-Buddy-$VER.run"; grep -q " $NAME$" "$T/SHA256SUMS" || NAME="SteamOS-EGPU-Buddy-$VER.run"   # before the rename
say "== downloading $NAME"
curl -fSL --progress-bar -o "$T/$NAME" "https://github.com/$REPO/releases/download/$TAG/$NAME"
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
