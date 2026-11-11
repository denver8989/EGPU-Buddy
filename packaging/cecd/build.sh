#!/usr/bin/env bash
# build.sh <out dir> — Valve's CEC service (cecd, from linux-cec: LGPL-2.1-or-later, by Vicki Pfau / Valve; copy at
# github.com/xXJSONDeruloXx/linux-cec) for systems that do not ship it (CachyOS, Bazzite...): SteamOS has it. Run in
# a Debian 12 container (rust:1-bookworm), so the binary runs on older and newer glibc alike. <out> gets usr/bin/cecd,
# its service / D-Bus / udev files and BUILT-FROM.
set -euo pipefail
OUT=${1:?out dir}; REPO=https://github.com/xXJSONDeruloXx/linux-cec.git; REV=361be30   # tag "cecd 0.3.0"
apt-get update -qq && apt-get install -y -qq --no-install-recommends libudev-dev pkg-config git ca-certificates >/dev/null
S=/tmp/linux-cec; rm -rf "$S"; git clone -q "$REPO" "$S"; cd "$S"; git checkout -q "$REV"
cargo build -q -r -p cecd --target-dir target
mkdir -p "$OUT/usr/bin" "$OUT/data"
install -m 755 target/release/cecd "$OUT/usr/bin/cecd"
cp -a cecd/data/cecd.service cecd/data/com.steampowered.CecDaemon1.service cecd/data/configs "$OUT/data/"
cp -a linux-cec/data/udev-rules.d/60-cec-uaccess.rules cecd/data/udev-rules.d/60-cecd-uinput.rules "$OUT/data/"
cp -a cecd/LICENSE "$OUT/LICENSE" 2>/dev/null || cp -a LICENSE* "$OUT/" 2>/dev/null || true
echo "linux-cec $REV" > "$OUT/BUILT-FROM"
"$OUT/usr/bin/cecd" --help 2>&1 | head -3 || true
