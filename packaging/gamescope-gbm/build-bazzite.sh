#!/usr/bin/env bash
# Bazzite: the NVIDIA Game Mode picture fix is built INTO THE GAMESCOPE BAZZITE SHIPS, whatever version that is.
# Bazzite's gamescope is the Open Gaming Collective fork (Terra's terra-gamescope, tag e.g. 3.16.31-ogc2). This takes
# the source of exactly that tag, applies the GBM scan-out route (bazzite/*.patch: NightHammer1000's GBM scan-out commits,
# ported to the OGC 3.16.31 line; if they ever stop applying, the original commits are replayed with git's merge
# machinery instead) plus 0001-force-composition-with-gbm-scanout.patch, and builds it the way Terra builds it
# (meson --auto-features=enabled, vkroots/wlroots/libliftoff from their subprojects; OpenVR off: Bazzite has none).
# The result goes to a private, user-independent prefix; Bazzite's own gamescope is never touched.
# Runs inside a fedora:<Bazzite's VERSION_ID> container (podman on the device, docker for a release build).
#   build-bazzite.sh <output dir> <OGC tag>          exit 3 = the fix does not apply to this tag (nothing built)
set -euo pipefail
OUT=${1:?output dir}; TAG=${2:?OGC gamescope tag, e.g. 3.16.31-ogc2}; HERE=$(cd "$(dirname "$0")" && pwd)
PREFIX=/usr/local/lib/egpu-buddy/gamescope-gbm/usr
REPO=https://github.com/OpenGamingCollective/gamescope
FORK_REPO=https://github.com/ValveSoftware/gamescope   # holds NightHammer1000's commits (fork network)
FORK_COMMITS="6d46d29 a86849b ebbaf8b b384ac4 6605942 092a2e7 2bfc18c736520b7d4f9756977213ea439daa1c63"
dnf -y -q install --setopt=install_weak_deps=False git-core meson ninja-build cmake gcc gcc-c++ glslang pkgconf-pkg-config \
  glm-devel google-benchmark-devel libXcursor-devel libXmu-devel catch2-devel hwdata-devel libavif-devel libcap-devel \
  libdecor-devel libdisplay-info-devel libdrm-devel mesa-libgbm-devel libeis-devel pipewire-devel systemd-devel luajit-devel \
  sdl2-compat-devel vulkan-loader-devel vulkan-headers wayland-protocols-devel wayland-devel libX11-devel libXcomposite-devel \
  libXdamage-devel libXext-devel libXfixes-devel libxkbcommon-devel libXrender-devel libXres-devel libXtst-devel \
  libXxf86vm-devel spirv-headers-devel lcms2-devel libinput-devel libseat-devel libxcb-devel xcb-util-errors-devel \
  xcb-util-wm-devel xcb-util-renderutil-devel xorg-x11-server-Xwayland-devel pixman-devel stb-devel >/dev/null
S=/tmp/gamescope-src; rm -rf "$S"; git init -q "$S"; cd "$S"
git config user.email egpu-buddy@localhost; git config user.name "EGPU Buddy"
git remote add origin "$REPO"; git fetch -q --depth 300 origin tag "$TAG"; git checkout -q "$TAG"
git submodule update -q --init --recursive --depth 1 2>/dev/null || git submodule update -q --init --recursive
if git am -q -3 "$HERE"/bazzite/*.patch 2>/dev/null; then echo "GBM scan-out route applied to $TAG (ported series)"
else
  git am --abort 2>/dev/null || true; git checkout -q -f "$TAG"
  git remote add fork "$FORK_REPO"; git fetch -q --depth 300 fork 2bfc18c736520b7d4f9756977213ea439daa1c63
  ok=1; for c in $FORK_COMMITS; do git cherry-pick -x "$c" >/dev/null 2>&1 || { ok=0; break; }; done
  [ "$ok" = 1 ] || { git cherry-pick --abort 2>/dev/null; echo "the GBM scan-out fix does not apply to gamescope $TAG"; exit 3; }
  echo "GBM scan-out route applied to $TAG (original commits replayed)"
fi
git apply "$HERE/0001-force-composition-with-gbm-scanout.patch" || { echo "0001 does not apply to gamescope $TAG"; exit 3; }
meson setup build --buildtype=release -Dprefix="$PREFIX" --auto-features=enabled \
  -Dforce_fallback_for=vkroots,wlroots,libliftoff -Denable_openvr_support=false -Denable_tests=false -Dbenchmark=disabled >/tmp/meson.log 2>&1 \
  || { tail -30 /tmp/meson.log; exit 1; }
grep -q 'HAVE_GBM=1' build/compile_commands.json || { echo "built without GBM: the fix would not be in it"; exit 1; }
ninja -C build >/tmp/ninja.log 2>&1 || { tail -40 /tmp/ninja.log; exit 1; }
meson install -C build --skip-subprojects >/dev/null
grep -qa 'drm_gbm_scanout' "$PREFIX/bin/gamescope" || { echo "the built gamescope has no GBM scan-out route"; exit 1; }
mkdir -p "$OUT"; rm -rf "${OUT:?}/usr"; cp -a "$PREFIX" "$OUT/usr"
echo "$TAG" > "$OUT/BUILT-FROM"
. /etc/os-release; echo "fedora-$VERSION_ID $TAG $(cat "$HERE"/bazzite/*.patch "$HERE"/0001-*.patch "$0" | sha256sum | cut -c1-16)" > "$OUT/BUILD-ID"
if ldd "$OUT/usr/bin/gamescope" | grep 'not found'; then echo "unresolved libraries"; exit 1; fi
echo "built: gamescope $TAG + GBM scan-out fix -> $OUT ($(cat "$OUT/BUILD-ID"))"
