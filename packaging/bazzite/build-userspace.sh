#!/usr/bin/env bash
# Runs INSIDE a Fedora container (podman on the Bazzite device). Produces NVIDIA's userspace for the patched driver
# version from THE SAME vendored recipes every other system builds it with (packaging/nvidia-open-egpu-615/userspace:
# Arch's nvidia-utils / lib32-nvidia-utils, pkgver and NVIDIA's sha512 pinned), out of NVIDIA's own installer from
# download.nvidia.com. Nothing is taken from another driver package.
# Fedora has no makepkg, so this does what makepkg does for these recipes: fetch + verify the sources, unpack the
# archives, run prepare()/build() and the package function, each with its own $pkgdir. Then the result is laid out
# the Fedora way: 64-bit libraries /usr/lib -> /usr/lib64, 32-bit /usr/lib32 -> /usr/lib (firmware, udev, modprobe,
# systemd and data stay where they are), with Fedora's per-architecture Vulkan ICD names.
#   build-userspace.sh <driver version>
#   mounts: /w = work dir (/w/src caches the downloads; result in /w/out/userspace/usr), /p = packaging dir (read-only)
#   build-userspace.sh --egl <pkg.arch>...   Fedora's EGL platform libraries the recipe depends on (open source, NVIDIA's
#                                            egl-wayland/-wayland2/-gbm/-x11) that Bazzite lacks -> /w/out/egl/usr
set -euo pipefail
if [ "${1:-}" = --egl ]; then
  shift; E=/w/out/egl; rm -rf /egl "$E"; mkdir -p /egl "$E"
  dnf -y -q install --setopt=install_weak_deps=False cpio >/dev/null
  dnf -q download --destdir /egl "$@" >/dev/null
  for r in /egl/*.rpm; do (cd "$E" && rpm2cpio "$r" | cpio -idm --quiet); done
  rm -rf "$E/usr/lib/.build-id" "$E/usr/share/doc" "$E/usr/share/licenses"; find "$E" -mindepth 1 -maxdepth 1 ! -name usr -exec rm -rf {} +
  echo "EGL platform libraries: $(ls /egl | tr '\n' ' ')"; exit 0
fi
V=${1:?version}; SRCCACHE=/w/src; OUT=/w/out/userspace
dnf -y -q install --setopt=install_weak_deps=False bsdtar binutils findutils xz perl-interpreter which file >/dev/null
mkdir -p "$SRCCACHE"; rm -rf /ub "$OUT"; mkdir -p /ub "$OUT"

run_recipe(){ # <recipe dir> <package function> <name>
  local R=$1 FN=$2 NAME=$3 S=/ub/$3/src P=/ub/$3/pkg
  mkdir -p "$S" "$P"
  ( set -e; CARCH=x86_64; srcdir=$S; pkgdir=$P; startdir=$S
    # shellcheck disable=SC1090
    . "$R/PKGBUILD"
    [ "$pkgver" = "$V" ] || { echo "recipe $R is $pkgver, wanted $V"; exit 2; }
    local -a srcs=("${source[@]}") sums=("${sha512sums[@]}")
    if declare -p source_x86_64 >/dev/null 2>&1; then srcs+=("${source_x86_64[@]}"); sums+=("${sha512sums_x86_64[@]}"); fi
    local i u f
    for i in "${!srcs[@]}"; do
      u=${srcs[$i]}; f=${u##*/}
      case "$u" in
        http*://*) if [ ! -s "$SRCCACHE/$f" ] || [ "$(sha512sum "$SRCCACHE/$f" | cut -d' ' -f1)" != "${sums[$i]}" ]; then
                     echo "downloading $f"; curl -fsSL --retry 3 -o "$SRCCACHE/$f.part" "$u"; mv "$SRCCACHE/$f.part" "$SRCCACHE/$f"; fi
                   ln -sf "$SRCCACHE/$f" "$S/$f" ;;
        *) cp "$R/$f" "$S/$f" ;;
      esac
      [ "$(sha512sum "$S/$f" | cut -d' ' -f1)" = "${sums[$i]}" ] || { echo "checksum mismatch: $f"; exit 3; }
      case "$f" in *.tar.xz|*.tar.gz|*.tar.zst|*.tar.bz2|*.tar) bsdtar -xf "$S/$f" -C "$S" ;; esac   # makepkg unpacks archives
    done
    cd "$S"; if declare -F prepare >/dev/null; then prepare; fi
    cd "$S"; if declare -F build >/dev/null; then build; fi
    cd "$S"; "$FN"
  ) >"/ub/$NAME.log" 2>&1 || { tail -30 "/ub/$NAME.log"; return 1; }
  echo "built $NAME"
}
run_recipe /p/userspace/nvidia-utils package_nvidia-utils nvidia-utils
run_recipe /p/userspace/lib32-nvidia-utils package_lib32-nvidia-utils lib32-nvidia-utils

# Fedora layout (files AND symlinks; relative symlinks stay valid because a whole directory level moves together)
place(){ # <source tree> <path under it> <destination path>
  [ -e "$1$2" ] || [ -L "$1$2" ] || return 0; mkdir -p "$(dirname "$OUT$3")"; cp -a "$1$2" "$OUT$3"; }
A=/ub/nvidia-utils/pkg; B=/ub/lib32-nvidia-utils/pkg
( cd "$A" && find . \( -type f -o -type l \) -path './usr/*' | sed 's#^\.##' ) | while read -r f; do
  case "$f" in
    /usr/lib/firmware/*|/usr/lib/udev/*|/usr/lib/modprobe.d/*|/usr/lib/systemd/*|/usr/lib/sysusers.d/*|/usr/lib/tmpfiles.d/*|/usr/lib/environment.d/*|/usr/lib/modules-load.d/*)
      place "$A" "$f" "$f" ;;
    /usr/lib/*) place "$A" "$f" "/usr/lib64/${f#/usr/lib/}" ;;      # libraries, gbm/, vdpau/, nvidia/ (wine, xorg), xorg/
    /usr/share/vulkan/icd.d/nvidia_icd.json) place "$A" "$f" /usr/share/vulkan/icd.d/nvidia_icd.x86_64.json ;;
    *) place "$A" "$f" "$f" ;;
  esac
done
( cd "$B" && find . \( -type f -o -type l \) -path './usr/*' | sed 's#^\.##' ) | while read -r f; do
  case "$f" in
    /usr/lib32/*) place "$B" "$f" "/usr/lib/${f#/usr/lib32/}" ;;
    /usr/share/licenses/*|/usr/share/doc/*) ;;
    *) place "$B" "$f" "$f" ;;
  esac
done
# Arch ships ONE icd file for both architectures (the loader of each finds libGLX_nvidia.so.0 for its own). Fedora's
# convention is one file per architecture tagged with library_arch, so each loader takes exactly one and the GPU is
# never listed twice: x86_64 -> "64", i686 -> "32".
J=$OUT/usr/share/vulkan/icd.d; [ -f "$J/nvidia_icd.x86_64.json" ] || { echo "missing the Vulkan ICD"; exit 4; }
grep -q library_arch "$J/nvidia_icd.x86_64.json" || sed -i 's/\("library_path"\)/"library_arch" : "64",\n        \1/' "$J/nvidia_icd.x86_64.json"
sed 's/"library_arch" : "64"/"library_arch" : "32"/' "$J/nvidia_icd.x86_64.json" > "$J/nvidia_icd.i686.json"
echo "$V" > "$OUT/.version"
echo "userspace $V: $(find "$OUT/usr" \( -type f -o -type l \) | wc -l) files, $(du -sh "$OUT/usr" | cut -f1)"
