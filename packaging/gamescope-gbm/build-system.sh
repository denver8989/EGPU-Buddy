#!/usr/bin/env bash
# The EGPU Buddy gamescope, built from EXACTLY the gamescope the system ships (SteamOS / CachyOS: Valve's source at the
# installed version), so an OS update that brings a new gamescope gets our changes again instead of an old pinned
# build. Our changes are real git commits (valve/egpu.bundle, on top of valve/BASE-TAG): cherry-picked onto the installed
# version, so git's three-way merge carries them across versions. They are the NVIDIA GBM scan-out route, the forced
# composition with it, --prefer-drm, XGPU passthrough and GAMESCOPE_KEEP_CONNECTOR (the touchpad picture on the
# handheld panel while Game Mode drives XR glasses). Bazzite: build-bazzite.sh (its OGC gamescope).
#   build-system.sh <version e.g. 3.17.0> <prefix>    exit 3 = our changes do not apply to this version (nothing built)
set -euo pipefail
VER=${1:?installed gamescope version}; PREFIX=${2:?install prefix}; HERE=$(cd "$(dirname "$0")" && pwd)
REPO=https://github.com/ValveSoftware/gamescope.git
S=${GAMESCOPE_SRC:-$HOME/build/gamescope-sys-$VER}
rm -rf "$S"; git init -q "$S"; cd "$S"
git config user.email egpu-buddy@localhost; git config user.name "EGPU Buddy"
git remote add origin "$REPO"; git fetch -q --depth 400 origin tag "$VER"; git checkout -q "$VER"
BASE=$(cat "$HERE/valve/BASE-TAG"); [ "$BASE" = "$VER" ] || git fetch -q --depth 400 origin tag "$BASE"
git fetch -q "$HERE/valve/egpu.bundle" egpu-port:refs/egpu/port
for c in $(git rev-list --reverse "$BASE..refs/egpu/port"); do
  git cherry-pick -x "$c" >/dev/null 2>&1 || { git cherry-pick --abort 2>/dev/null; echo "our gamescope changes do not apply to $VER ($(git log -1 --format=%s "$c"))"; exit 3; }
done
echo "EGPU Buddy changes applied to gamescope $VER"
git submodule update -q --init --recursive --depth 1 2>/dev/null || git submodule update -q --init --recursive
meson setup build . --buildtype=release -Dprefix="$PREFIX" -Dpipewire=disabled -Davif_screenshots=disabled >/dev/null
ninja -C build >/dev/null
ninja -C build install >/dev/null 2>&1 || meson install -C build --skip-subprojects >/dev/null
"$PREFIX/bin/gamescope" --version 2>&1 | grep -o 'gamescope version [^ ]*'
echo "$VER" > "$PREFIX/../BUILT-FROM"
