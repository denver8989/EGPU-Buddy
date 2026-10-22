#!/usr/bin/env bash
# Build the Bazzite QML runner (inside fedora:<N>, the same container as the Bazzite gamescope). Output: $1/egpu-buddy-qml
set -euo pipefail
OUT=${1:?output dir}; HERE=$(cd "$(dirname "$0")" && pwd)
dnf -y -q install --setopt=install_weak_deps=False gcc-c++ qt6-qtbase-devel qt6-qtdeclarative-devel >/dev/null
mkdir -p "$OUT"
g++ -O2 -fPIC -std=c++17 "$HERE/main.cpp" -o "$OUT/egpu-buddy-qml" $(pkg-config --cflags --libs Qt6Gui Qt6Qml)
strip "$OUT/egpu-buddy-qml"; echo "built $OUT/egpu-buddy-qml: $(ldd "$OUT/egpu-buddy-qml" | grep -o 'libQt6[A-Za-z]*' | sort -u | tr '\n' ' ')"
