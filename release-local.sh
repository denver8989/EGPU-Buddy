#!/usr/bin/env bash
# release-local.sh — publish VERSION from this machine with gh, the same steps as .github/workflows/release.yml,
# without GitHub Actions (owner, 2026-11-12: Actions minutes nearly used up). The container builds (Bazzite gamescope,
# Bazzite QML runner, cecd) are carried forward from the previous release and rebuilt here with podman only when their
# inputs changed.
set -euo pipefail
cd "$(dirname "$0")"
[ "$(git rev-parse --abbrev-ref HEAD)" = master ] || { echo "releases are published from master only"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit first: the tree has changes"; exit 1; }
git fetch -q origin; [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)" ] || { echo "push master first"; exit 1; }
VER=$(cat VERSION); NAME="EGPU-Buddy-$VER"; OLD="SteamOS-EGPU-Buddy-$VER"   # OLD: the pre-rename name, still published for installed updaters
[ "${1:-}" = --check ] || ! gh release view "v$VER" >/dev/null 2>&1 || { echo "v$VER is already released"; exit 1; }
python3 release-notes-for.py "$VER" RELEASE-NOTES.md >/dev/null
T=$(mktemp -d); trap 'rm -rf "$T"; git checkout -q -- decky-plugin/egpu-buddy' EXIT   # build-release.sh stamps the version into the plugin sources
PREV=$(gh release view --json tagName --jq .tagName); echo "prebuilt from $PREV"
# the previous release's tarball under either name (releases before 0.7.284 have only SteamOS-EGPU-Buddy-*)
gh release download "$PREV" --pattern 'EGPU-Buddy-[0-9]*.tar.gz' --dir "$T" 2>/dev/null || gh release download "$PREV" --pattern 'SteamOS-EGPU-Buddy-*.tar.gz' --dir "$T"
P1=$(ls "$T"/*.tar.gz | head -1); mkdir -p "$T/prev"; tar -xzf "$P1" -C "$T/prev"; rm -rf prebuilt; cp -a "$T"/prev/*/prebuilt .
test -x prebuilt/gamescope-gbm/usr/bin/gamescope
# container-built parts: rebuilt here with podman (images on the 3.2 TB drive, ~/.config/containers/storage.conf) only
# when their inputs changed, exactly like the workflow; a failed build keeps the previous one, as the workflow does
run(){ podman run --rm "$@"; }
BT=$(cat packaging/gamescope-gbm/bazzite/BASE-TAG)
if [ "$(cat prebuilt/bazzite-gamescope-gbm/BUILT-FROM 2>/dev/null)" != "$BT" ]; then
  mkdir -p "$T/bz"; if run -v "$PWD/packaging/gamescope-gbm":/gs:ro -v "$T/bz":/out docker.io/library/fedora:44 bash /gs/build-bazzite.sh /out "$BT"; then
    rm -rf prebuilt/bazzite-gamescope-gbm; cp -a "$T/bz" prebuilt/bazzite-gamescope-gbm; else echo "WARNING: the Bazzite gamescope build failed; devices build it on install"; fi
fi
QWANT="fedora-44 $(cat packaging/bazzite/qml-runner/main.cpp packaging/bazzite/qml-runner/build.sh | sha256sum | cut -c1-16)"
if [ "$(cat prebuilt/bazzite-qml-runner/BUILD-ID 2>/dev/null)" != "$QWANT" ]; then
  mkdir -p "$T/qr"; if run -v "$PWD/packaging/bazzite/qml-runner":/q:ro -v "$T/qr":/out docker.io/library/fedora:44 bash /q/build.sh /out; then
    rm -rf prebuilt/bazzite-qml-runner; cp -a "$T/qr" prebuilt/bazzite-qml-runner; echo "$QWANT" > prebuilt/bazzite-qml-runner/BUILD-ID
  else echo "WARNING: the Bazzite QML runner build failed; this release ships the previous one"; fi
fi
CWANT=$(sha256sum packaging/cecd/build.sh | cut -c1-16)
if [ "$(cat prebuilt/cecd/BUILD-ID 2>/dev/null)" != "$CWANT" ]; then
  mkdir -p "$T/cecd"; if run -v "$PWD/packaging/cecd":/b:ro -v "$T/cecd":/out docker.io/library/rust:1-bookworm bash /b/build.sh /out; then
    rm -rf prebuilt/cecd; cp -a "$T/cecd" prebuilt/cecd; echo "$CWANT" > prebuilt/cecd/BUILD-ID
  else echo "WARNING: the cecd build failed; this release ships the previous one"; fi
fi
[ "${1:-}" = --check ] && { ./build-release.sh >/dev/null && ls -la dist/*"$VER"* && echo "check ok: build works, nothing published"; exit 0; }
./build-release.sh
test -s "dist/$NAME.tar.gz"; test -s "dist/$NAME.run"; ALIAS=""; [ -e "dist/$OLD.tar.gz" ] && { cmp -s "dist/$NAME.tar.gz" "dist/$OLD.tar.gz"; grep -q " $OLD.tar.gz$" dist/SHA256SUMS; ALIAS="dist/$OLD.run dist/$OLD.tar.gz"; }   # 0.7.284-0.7.288 only (build-release.sh)
# listings to files first: `cmd | grep -q` fails under pipefail when grep stops early
unzip -l "dist/EGPU-Buddy-Decky-$VER.zip" > "$T/zip.txt"; tar -tzf "dist/$NAME.tar.gz" > "$T/tar.txt"
grep -q "payload/$NAME.tar.gz" "$T/zip.txt"; grep -q "EGPU-Buddy/dist/index.js" "$T/zip.txt"
grep -q "prebuilt/gamescope-gbm/usr/bin/gamescope$" "$T/tar.txt"
python3 release-notes-for.py "$VER" RELEASE-NOTES.md > "dist/NOTES-$VER.md"
gh release create "v$VER" --target "$(git rev-parse HEAD)" \
  "dist/$NAME.run" "dist/$NAME.tar.gz" "dist/EGPU-Buddy-Decky-$VER.zip" $ALIAS dist/SHA256SUMS get-egpu-buddy.sh \
  --title "EGPU Buddy $VER" --notes-file "dist/NOTES-$VER.md"
echo "published v$VER"
