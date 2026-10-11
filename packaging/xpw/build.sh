#!/usr/bin/env bash
# Build the display-GPU side of the handheld passthrough: PyroWave (github.com/Themaister/pyrowave, MIT, pinned) as a
# shared library, plus libxpw (this folder). Output: a private folder with libpyrowave-shared.so.1 + libxpw.so (RUNPATH
# $ORIGIN), loaded by the patched gamescope through GAMESCOPE_XGPU_LIB. Only needed for the opt-in passthrough option.
# conv.inc is the SPIR-V of conv.comp (glslc -O conv.comp -mfmt=num -o conv.inc), kept so no shader compiler is needed.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${PYROWAVE_REPO:-https://github.com/Themaister/pyrowave.git}
COMMIT=${PYROWAVE_COMMIT:-502a3b52a39312ab82c85b1e2fc0e746faee91a4}   # 2026-10-08; pins Granite fb178c80 via checkout_granite.sh
SRC=${PYROWAVE_SRC:-$HOME/build/pyrowave}
OUT=${XPW_PREFIX:-$HOME/.local/lib/nv-egpu-buddy/xpw}
[ -d "$SRC/.git" ] || git clone -q "$REPO" "$SRC"
git -C "$SRC" checkout -q "$COMMIT" 2>/dev/null || { git -C "$SRC" fetch -q origin; git -C "$SRC" checkout -q "$COMMIT"; }
[ -d "$SRC/Granite/vulkan" ] || (cd "$SRC" && bash ./checkout_granite.sh >/dev/null)
cmake -S "$SRC" -B "$SRC/build-lib" -G Ninja -DCMAKE_BUILD_TYPE=Release -DPYROWAVE_DEVEL=OFF >/dev/null
ninja -C "$SRC/build-lib" pyrowave-shared >/dev/null
mkdir -p "$OUT"
cp -L "$SRC/build-lib/libpyrowave-shared.so.1" "$OUT/"
c++ -O2 -std=c++17 -shared -fPIC "$HERE/xpw.cpp" -I"$SRC" -I"$HERE" "$OUT/libpyrowave-shared.so.1" -lvulkan \
  -Wl,-rpath,'$ORIGIN' -o "$OUT/libxpw.so"
ldd "$OUT/libxpw.so" | grep -q 'not found' && { echo "libxpw has unresolved libraries" >&2; exit 1; }
echo "installed: $OUT/libxpw.so"
