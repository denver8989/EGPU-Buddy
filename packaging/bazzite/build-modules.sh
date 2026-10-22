#!/usr/bin/env bash
# Runs INSIDE a Fedora container (podman on the Bazzite device): builds the patched NVIDIA open kernel modules for
# exactly one Bazzite kernel, the same way the PKGBUILD does (stock source + the same patches in the same order),
# signs them when a key is given (Secure Boot) and compresses them like Fedora's kmods (xz, crc32, 1 MiB dictionary).
#   build-modules.sh <kernel release> <driver version>
#   mounts: /w = work dir (kernel-devel-<k>.rpm, NVIDIA-kernel-module-source-<v>.tar.xz; output in /w/out/<k>)
#           /p = driver packaging dir (PKGBUILD + patches, read-only)     /k = signing key (optional, read-only)
set -euo pipefail
K=${1:?kernel}; V=${2:?version}; OUT=/w/out/$K
dnf -y -q install --setopt=install_weak_deps=False gcc make patch xz kmod findutils diffutils elfutils-libelf-devel \
  bc bison flex perl openssl >/dev/null
rpm -i --nodeps --replacepkgs "/w/kernel-devel-$K.rpm"
KS=/usr/src/kernels/$K; [ -f "$KS/Makefile" ] || { echo "kernel-devel did not install $KS"; exit 2; }
MK=(); if grep -q '^CONFIG_CC_IS_CLANG=y' "$KS/.config"; then dnf -y -q install clang lld llvm >/dev/null; MK=(CC=clang LD=ld.lld LLVM=1); fi
rm -rf /build; mkdir /build; tar -xf "/w/NVIDIA-kernel-module-source-$V.tar.xz" -C /build; S=/build/NVIDIA-kernel-module-source-$V
# the patch order of the PKGBUILD's prepare()
for p in $(sed -n 's/.*-i "${srcdir}\/\([^"]*\.patch\)".*/\1/p' /p/PKGBUILD); do patch -d "$S" -Np1 -i "/p/$p" >/dev/null; echo "patched: $p"; done
make -C "$S" modules -j"$(nproc)" SYSSRC="$KS" SYSOUT="$KS" "${MK[@]}" >/build/make.log 2>&1 || { tail -40 /build/make.log; exit 3; }
rm -rf "$OUT"; mkdir -p "$OUT"
for m in nvidia nvidia-modeset nvidia-drm nvidia-uvm nvidia-peermem; do
  f=$S/kernel-open/$m.ko; [ -f "$f" ] || continue
  [ "$(modinfo -F vermagic "$f" | cut -d' ' -f1)" = "$K" ] || { echo "$m: wrong vermagic"; exit 4; }
  [ -r /k/egpu-buddy.priv ] && "$KS/scripts/sign-file" sha256 /k/egpu-buddy.priv /k/egpu-buddy.der "$f"
  cp "$f" "$OUT/"; xz -f --check=crc32 --lzma2=dict=1MiB "$OUT/$m.ko"
done
for m in nvidia nvidia-modeset nvidia-drm; do [ -f "$OUT/$m.ko.xz" ] || { echo "missing $m.ko"; exit 5; }; done
echo "built for $K: $(cd "$OUT" && ls | tr '\n' ' ')signer: $(modinfo -F signer "$OUT/nvidia.ko.xz" || true)"
