#!/bin/bash
# Build egpu-nvt (EGPU Buddy's NVIDIA settings loader) for 64- and 32-bit games: build.sh <out dir>
# The release builds it in an old Debian (glibc 2.31) so it also loads inside Steam's runtime containers.
set -euo pipefail
OUT=${1:?usage: build.sh <out dir>}; SRC=$(cd "$(dirname "$0")" && pwd)/egpu-nvt.c
if [ -f /etc/debian_version ] && ! command -v gcc >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive; apt-get update -qq >/dev/null && apt-get install -y -qq gcc gcc-multilib >/dev/null
fi
CF=(-O2 -fPIC -shared -Wall -Wextra -fno-stack-protector -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=0 -Wl,-z,defs -Wl,--as-needed)
mkdir -p "$OUT/lib64" "$OUT/lib32"
gcc -m64 "${CF[@]}" -o "$OUT/lib64/libegpu-nvt.so" "$SRC"
gcc -m32 "${CF[@]}" -o "$OUT/lib32/libegpu-nvt.so" "$SRC"
sha256sum "$SRC" | cut -c1-16 > "$OUT/BUILD-ID"
ls -la "$OUT"/lib*/libegpu-nvt.so
