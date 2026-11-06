#!/bin/bash
# Build egpu-steam-ui (EGPU Buddy's Steam menu fix for Big Art mode on an NVIDIA eGPU): build.sh <out dir>
# 64-bit only (Steam's interface process is 64-bit). Needs the X11 / xcb / Vulkan development headers.
set -euo pipefail
OUT=${1:?usage: build.sh <out dir>}; SRC=$(cd "$(dirname "$0")" && pwd)/egpu-steam-ui.c
mkdir -p "$OUT"
gcc -O2 -fPIC -shared -Wall -Wno-misleading-indentation -Wno-nonnull-compare -Wno-missing-braces -Wl,--as-needed \
  -o "$OUT/libegpu-steam-ui.so" "$SRC" -lxcb -lxcb-shm -lxcb-dri3 -lXdamage -lXfixes -lX11 -ldl -lpthread
sha256sum "$SRC" | cut -c1-16 > "$OUT/BUILD-ID"
ls -la "$OUT/libegpu-steam-ui.so"
