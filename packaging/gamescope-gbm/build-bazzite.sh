#!/usr/bin/env bash
# Bazzite: the GBM-scanout gamescope (NVIDIA scan-out corruption fix) built in a Fedora container matching Bazzite's
# base, so it links against the libraries Bazzite ships. Runs in the release workflow (docker, fedora:<N>), not on a
# device: Bazzite's /usr is read-only and has no compilers. The prefix is compiled into the binary (script directory)
# and is user-independent; install.sh puts the tree there on Bazzite only.
#   build-bazzite.sh <output dir>      (run as root inside fedora:44)
set -euo pipefail
OUT=${1:?output dir}; HERE=$(cd "$(dirname "$0")" && pwd)
PREFIX=/usr/local/lib/egpu-buddy/gamescope-gbm/usr
dnf -y -q install dnf-plugins-core git >/dev/null
dnf -y -q builddep gamescope >/dev/null                         # Fedora's own gamescope build dependencies
# + what the bundled subprojects (wlroots with Xwayland, libliftoff, vkroots...) need beyond Fedora's own gamescope build
dnf -y -q install --skip-unavailable meson ninja-build cmake gcc-c++ glslang pkgconf-pkg-config git \
  mesa-libgbm-devel mesa-libEGL-devel libdrm-devel vulkan-headers vulkan-loader-devel luajit-devel libdisplay-info-devel \
  libei-devel libliftoff-devel hwdata hwdata-devel xorg-x11-server-Xwayland xorg-x11-server-Xwayland-devel \
  wayland-devel wayland-protocols-devel libxkbcommon-devel libinput-devel libseat-devel pixman-devel lcms2-devel \
  libX11-devel libxcb-devel xcb-util-wm-devel xcb-util-renderutil-devel xcb-util-errors-devel libXcomposite-devel \
  libXdamage-devel libXext-devel libXfixes-devel libXmu-devel libXrender-devel libXres-devel libXtst-devel libXxf86vm-devel \
  libXcursor-devel libXi-devel libcap-devel libdecor-devel sdl2-compat-devel glm-devel google-benchmark-devel stb-devel \
  libavif-devel libeis-devel systemd-devel pipewire-devel libv4l-devel >/dev/null
GAMESCOPE_GBM_SRC=/tmp/gamescope-src GAMESCOPE_GBM_PREFIX=$PREFIX bash "$HERE/build.sh"
mkdir -p "$OUT"; rm -rf "$OUT/usr"; cp -a "$PREFIX" "$OUT/usr"
. /etc/os-release; echo "fedora-$VERSION_ID $(cat "$HERE"/build.sh "$HERE"/0*.patch | sha256sum | cut -c1-16)" > "$OUT/BUILD-ID"
ldd "$OUT/usr/bin/gamescope" | grep 'not found' && { echo "unresolved libraries" >&2; exit 1; }
echo "built: $OUT ($(cat "$OUT/BUILD-ID"))"
