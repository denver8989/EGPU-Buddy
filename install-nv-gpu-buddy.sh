#!/usr/bin/env bash
# NV GPU Buddy (EXPERIMENTAL track): EGPU Buddy for a machine with a BUILT-IN NVIDIA card (desktop PC, laptop), or a
# desktop PC that is getting one ("card coming": the driver is installed ahead, the card works from its first boot).
# What it brings: NVIDIA settings and their game loader, power and clock controls, the Big Art menu fix, screens, keep
# awake, the support report, updates, and this project's patched NVIDIA driver (the same build eGPU installs run).
# What it never installs: hot-plug rules, the eGPU Game Mode session, the boot policy, dock tools, kernel parameters,
# the "block driver autoload" and "force external GPU" driver options. NVIDIA only (no AMD / Intel install here).
#
# install.sh hands over here ONLY when this track is recorded (/etc/nv-egpu-buddy/track) or was just chosen and
# confirmed; nothing here runs on an eGPU install. Usage:
#   install-nv-gpu-buddy.sh [--card-coming]   install / update (--card-coming: no NVIDIA card in the machine yet)
#   install-nv-gpu-buddy.sh --uninstall       remove everything this track installed (the driver only if it was ours)
#   install-nv-gpu-buddy.sh --selfheal        at boot (egpu-buddy-selfheal.service): repair after an OS update, load the driver
set -euo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
VER=$(cat "$ROOT/VERSION" 2>/dev/null || echo dev)
TRACK_F=/etc/nv-egpu-buddy/track
if [ "$(id -u)" = 0 ]; then
  USER_NAME=${EGPU_TARGET_USER:-${SUDO_USER:-}}
  [ -n "$USER_NAME" ] || USER_NAME=$(stat -c %U "$ROOT" 2>/dev/null)   # self-heal: the payload lives in the user's home
  [ -n "$USER_NAME" ] && [ "$USER_NAME" != root ] || { echo "running as root: set EGPU_TARGET_USER=<login user>"; exit 1; }
  AS_ROOT=1; sudo(){ "$@"; }
else
  USER_NAME=${SUDO_USER:-$USER}; AS_ROOT=0
fi
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6); USER_UID=$(id -u "$USER_NAME"); USER_GROUP=$(id -gn "$USER_NAME")
MODE=install; CARD_COMING=${EGPU_NV_CARD_COMING:-0}   # the plugin passes its choice this way (install.sh takes no such option)
for a in "$@"; do case "$a" in --uninstall) MODE=uninstall;; --selfheal) MODE=selfheal;; --card-coming) CARD_COMING=1;; --check) MODE=check;;
  --nvidia|--with-driver|--no-gamescope) ;; --amd|--no-nvidia) echo "NV GPU Buddy is NVIDIA only; for an AMD / Intel eGPU use the normal install"; exit 1;;
  *) echo "unknown option $a"; exit 1;; esac; done
say(){ printf '\033[1m%s\033[0m\n' "$*"; }
. /etc/os-release 2>/dev/null || true
IS_BAZZITE=0; case "${ID:-} ${NAME:-}" in *[Bb]azzite*) IS_BAZZITE=1 ;; esac
RO=$(command -v steamos-readonly || true)
DETECT="$ROOT/system/usr/local/sbin/egpu-detect"
DRVDIR="$ROOT/packaging/nvidia-open-egpu-615"   # the main driver since 0.7.220; no beta trials on this track
SX="$DRVDIR/install-steamos-sysext.sh"
ucmd(){ if [ "$AS_ROOT" = 1 ]; then runuser -u "$USER_NAME" -- "$@"; else "$@"; fi; }
userctl(){ if [ "$AS_ROOT" = 1 ]; then runuser -u "$USER_NAME" -- env "XDG_RUNTIME_DIR=/run/user/$USER_UID" "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_UID/bus" systemctl --user "$@"; else systemctl --user "$@"; fi; }
# the scripts are written for user "deck", uid 1000 (the same rewrite install.sh does)
templ(){ sed -e "s|/home/deck|$USER_HOME|g" -e "s|^deck ALL=|$USER_NAME ALL=|" -e "s|/run/user/1000|/run/user/$USER_UID|g" -e "s|getent passwd 1000\\b|getent passwd $USER_UID|g" -e "s|runuser -u deck |runuser -u $USER_NAME |g"; }

# what this track puts on the machine (the uninstall removes exactly these)
SYS_FILES="usr/local/sbin/egpu-detect usr/local/sbin/nv-egpu-buddy-privileged usr/local/bin/nv-egpu-offset-helper usr/local/sbin/egpu-screen
  usr/local/sbin/egpu-report usr/local/sbin/egpu-snapshot usr/local/sbin/egpu-game-running usr/local/sbin/egpu-buddy-update etc/systemd/system/egpu-buddy-selfheal.service"
USER_FILES=".local/bin/egpu-nvidia-tweaks .local/bin/egpu-steam-ui-fix"
SUDOERS=/etc/sudoers.d/zz-steamos-egpu-buddy
SH_DROPIN=/etc/systemd/system/egpu-buddy-selfheal.service.d/10-nv-gpu-buddy.conf
SL_DROPIN="$USER_HOME/.config/systemd/user/steam-launcher.service.d/zz-nv-gpu-buddy.conf"
GSP_HOOK_DIR="$USER_HOME/.config/gamescope-session-plus/sessions.d"
NV_ENV="$USER_HOME/.config/egpu-buddy/nv-gpu-buddy.env"
LIBD="$USER_HOME/.local/lib/nv-egpu-buddy"
PERSIST="$USER_HOME/.local/share/steamos-egpu-buddy"
PLUGIN="$USER_HOME/homebrew/plugins/EGPU-Buddy"

# SteamOS: /usr/local is on the read-only system partition, and a merged driver extension makes all of /usr read-only.
# Writable for the run; the extension is unmerged while files are written and merged again on every way out. A built-in
# card is in use whenever anything shows a picture on it: then the update is STAGED for the next boot (self-heal).
steamos_writable(){   # $1: what to say when the card is in use
  [ -n "$RO" ] || return 0
  [ "$(steamos-readonly status 2>/dev/null)" = enabled ] && { sudo steamos-readonly disable >/dev/null 2>&1 || true; trap 'sudo steamos-readonly enable >/dev/null 2>&1 || true' EXIT; }
  grep -q '^sysext /usr ' /proc/mounts 2>/dev/null || return 0
  if [ -d /sys/module/nvidia ] && ! fuser /dev/nvidia* >/dev/null 2>&1; then
    sudo modprobe -r nvidia_drm nvidia_modeset nvidia_uvm nvidia >/dev/null 2>&1 || true
  fi
  if [ -d /sys/module/nvidia ]; then
    echo "${1:-The NVIDIA card is in use, so the system files cannot be written now. The update is STAGED: it installs by itself on the next reboot.}"
    exit 21
  fi
  sudo systemd-sysext unmerge >/dev/null 2>&1 || { echo "could not unmerge the driver extension; nothing was changed"; exit 21; }
  trap 'sudo bash "$SX" --activate >/dev/null 2>&1 || true; sudo steamos-readonly enable >/dev/null 2>&1 || true' EXIT
}

load_driver(){   # the built-in card's driver, when it did not load by itself (SteamOS: the extension merges after udev)
  lspci -Dn 2>/dev/null | grep -qE ' 03(00|02): 10de:' || return 0
  [ -d /sys/module/nvidia_drm ] && return 0
  timeout 45 modprobe nvidia_drm 2>&1 | tail -1 && timeout 15 modprobe nvidia_uvm >/dev/null 2>&1
  [ -d /sys/module/nvidia_drm ] && echo "NVIDIA driver loaded" || echo "NVIDIA driver did not load: this boot runs on the built-in graphics"
}

uninstall(){
  set +e   # remove as much as possible: one step failing must not leave the rest behind
  say "== NV GPU Buddy: uninstalling"
  steamos_writable "The NVIDIA card is in use, so its driver cannot be removed now. Switch to Desktop Mode, close every game and app, and run the uninstall again. Nothing was changed."
  sudo systemctl disable egpu-buddy-selfheal.service >/dev/null 2>&1 || true
  for f in $SYS_FILES; do sudo rm -f "/$f" "/$f".bak-egpu-buddy-* && echo "removed  /$f"; done
  sudo rm -f "$SUDOERS" "$SH_DROPIN"; sudo rmdir "${SH_DROPIN%/*}" 2>/dev/null || true
  for f in $USER_FILES; do rm -f "$USER_HOME/$f" && echo "removed  $USER_HOME/$f"; done
  rm -f "$SL_DROPIN" "$NV_ENV"; rm -rf "$LIBD/nvt" "$LIBD/steam-ui-fix"
  userctl disable --now egpu-buddy-tray.service >/dev/null 2>&1 || true
  rm -rf "$USER_HOME/.local/share/egpu-buddy"; rm -f "$USER_HOME/.local/bin/egpu-buddy" "$USER_HOME/.config/systemd/user/egpu-buddy-tray.service"
  for f in egpu-buddy egpu-buddy-report; do rm -f "$USER_HOME/.local/share/applications/$f.desktop" "$USER_HOME/Desktop/$f.desktop"; done
  for c in steam ogui-steam; do grep -qs 'NV GPU Buddy' "$GSP_HOOK_DIR/$c" && rm -f "$GSP_HOOK_DIR/$c"; done
  # the driver goes only if this track installed it; a driver the machine had before comes back
  if [ -n "$RO" ]; then
    [ -x "$SX" ] && { sudo bash "$SX" --remove 2>&1 | tail -1 || true; }
  elif [ -x /usr/local/sbin/egpu-bazzite-driver ]; then
    { sudo /usr/local/sbin/egpu-bazzite-driver --remove 2>&1 | tail -1 || true; }; sudo semodule -r egpu-nvidia-sleep >/dev/null 2>&1 || true
    sudo rm -f /usr/local/sbin/egpu-bazzite-driver /etc/systemd/system/egpu-bazzite-driver-guard.service /etc/systemd/system/egpu-bazzite-boot-ok.service /etc/modprobe.d/egpu-bazzite-no-nouveau.conf /etc/modprobe.d/egpu-nvidia-open.conf
  elif command -v pacman >/dev/null 2>&1 && pacman -Q nvidia-open-egpu-dkms >/dev/null 2>&1; then
    for pk in nvidia-utils lib32-nvidia-utils opencl-nvidia lib32-opencl-nvidia; do
      sudo sed -i -E "s/^(IgnorePkg[[:space:]]*=.*)[[:space:]]+$pk\b/\1/; s/^(IgnorePkg[[:space:]]*=)[[:space:]]*$pk\b/\1/" /etc/pacman.conf; done
    sudo sed -i -E '/^IgnorePkg[[:space:]]*=[[:space:]]*$/d' /etc/pacman.conf
    prev=$(cat /etc/nv-egpu-buddy/nv-prev-packages 2>/dev/null || true)
    if [ -n "$prev" ]; then
      # one transaction: the distro's driver replaces ours, so the machine keeps a working NVIDIA driver
      say "== putting back the distro NVIDIA driver: $prev"
      # shellcheck disable=SC2086
      sudo pacman -S --noconfirm --ask 4 $prev || echo "WARNING: could not reinstall $prev; the patched driver stays in place"
    else
      sudo pacman -R --noconfirm nvidia-open-egpu-dkms 2>&1 | tail -1 || true
    fi
  fi
  sudo rm -rf "$TRACK_F" /etc/nv-egpu-buddy /var/lib/nvegpu
  [ "${EGPU_KEEP_PLUGIN:-0}" = 1 ] || sudo rm -rf "$PLUGIN"
  rm -rf "$PERSIST"
  sudo systemctl daemon-reload >/dev/null 2>&1 || true; userctl daemon-reload >/dev/null 2>&1 || true
  sudo systemctl restart plugin_loader.service >/dev/null 2>&1 || true
  say "done. NV GPU Buddy is removed."
}

selfheal(){
  local need=0
  [ -x /usr/local/sbin/nv-egpu-buddy-privileged ] && [ "$(cat /etc/nv-egpu-buddy/version 2>/dev/null)" = "$VER" ] || need=1
  if [ "$need" = 1 ]; then echo "integration missing or outdated: installing $VER"; EGPU_TARGET_USER=$USER_NAME bash "$0" || echo "repair reported errors"; fi
  if [ -n "$RO" ] && [ -x "$SX" ] && [ -d /home/.egpu-buddy ]; then
    bash "$SX" --activate || {
      echo "driver extension has no modules for $(uname -r): rebuilding in the background"
      systemd-run --quiet --collect --unit=egpu-buddy-driver-build --property=TimeoutStartSec=5400 /bin/bash -c \
        "for i in \$(seq 1 40); do curl -sI -o /dev/null --max-time 8 https://steamdeck-packages.steamos.cloud/ 2>/dev/null && break; sleep 30; done; EGPU_DEFER_SWAP=1 bash '$SX' --boot; modprobe nvidia_drm" || true; }
  elif command -v dkms >/dev/null 2>&1 && ! modinfo -n nvidia >/dev/null 2>&1 && [ -f "/usr/lib/modules/$(uname -r)/build/Makefile" ]; then
    timeout 300 dkms autoinstall -k "$(uname -r)" >/dev/null 2>&1 && echo "dkms built the driver for $(uname -r)"
  fi
  load_driver
}

case "$MODE" in
  uninstall) uninstall; exit 0 ;;
  selfheal) selfheal; exit 0 ;;
  check) echo "NV GPU Buddy track $(cat "$TRACK_F" 2>/dev/null || echo '(not installed)'), version $(cat /etc/nv-egpu-buddy/version 2>/dev/null || echo none)"; exit 0 ;;
esac

# ---- preflight --------------------------------------------------------------------------------------------------
say "== preflight (NV GPU Buddy, experimental)"
MACHINE=$(bash "$DETECT" --machine 2>/dev/null || echo egpu)
case "$MACHINE" in
  handheld) echo "This is a handheld. NV GPU Buddy is for desktop PCs and laptops with a built-in NVIDIA card: use the normal EGPU Buddy install."; exit 30 ;;
  nv-desktop*|nv-laptop*) echo "machine: ${MACHINE%% *} (NVIDIA card ${MACHINE#* })" ;;
  *) if [ -s "$TRACK_F" ] || [ "$CARD_COMING" = 1 ]; then echo "machine: no built-in NVIDIA card right now (card coming)"
     else echo "No built-in NVIDIA card was found (an eGPU or USB4 dock connected, or unsure). Nothing was changed."; exit 31; fi ;;
esac
if [ "$IS_BAZZITE" = 1 ] && [ -n "$(rpm -qa 'kmod-nvidia*' 'akmod-nvidia*' 2>/dev/null)" ]; then
  echo "This Bazzite image carries NVIDIA's own driver, and NV GPU Buddy needs its patched one (the two cannot be used together)."
  echo "Switch to the same Bazzite image without NVIDIA (e.g. bazzite-deck instead of bazzite-deck-nvidia), then install again. Nothing was changed."
  exit 32
fi
steamos_writable

# ---- the patched NVIDIA driver (the one every EGPU Buddy NVIDIA install runs) -----------------------------------
DRIVER_FAILED=0
PKGV="$(sed -n 's/^pkgver=//p' "$DRVDIR/PKGBUILD")-$(sed -n 's/^pkgrel=//p' "$DRVDIR/PKGBUILD")"
sudo mkdir -p /etc/nv-egpu-buddy /var/lib/nvegpu
if [ "$IS_BAZZITE" = 1 ]; then
  BZ=$ROOT/packaging/bazzite
  if [ ! -x /usr/local/sbin/egpu-bazzite-driver ] || ! sudo /usr/local/sbin/egpu-bazzite-driver --status >/dev/null 2>&1; then
    sudo bash -c 'set -e; L=/usr/local/lib/egpu-buddy/bazzite; mkdir -p "$L/nvidia-open-egpu-615"
      install -m755 "$1/egpu-bazzite-driver" /usr/local/sbin/egpu-bazzite-driver
      install -m644 "$1/fetch-kernel-devel.py" "$1/build-modules.sh" "$1/build-userspace.sh" "$L/"
      install -m644 "$2"/PKGBUILD "$2"/*.patch "$L/nvidia-open-egpu-615/"; rm -rf "$L/nvidia-open-egpu-615/userspace"; cp -r "$2/userspace" "$L/nvidia-open-egpu-615/userspace"
      printf "blacklist nouveau\nblacklist nova_core\nblacklist nova_drm\n" > /etc/modprobe.d/egpu-bazzite-no-nouveau.conf
      printf "options nvidia NVreg_OpenRmEnableUnsupportedGpus=1\n" > /etc/modprobe.d/egpu-nvidia-open.conf
      install -m644 "$1/egpu-bazzite-driver-guard.service" "$1/egpu-bazzite-boot-ok.service" /etc/systemd/system/; systemctl daemon-reload
      command -v semodule >/dev/null && { semodule -l 2>/dev/null | grep -qx egpu-nvidia-sleep || semodule -i "$1/egpu-nvidia-sleep.cil" 2>/dev/null || true; }
      command -v restorecon >/dev/null && restorecon /usr/local/sbin/egpu-bazzite-driver /etc/systemd/system/egpu-bazzite-*.service 2>/dev/null || true' _ "$BZ" "$DRVDIR"
    say "== Bazzite: building the patched NVIDIA driver (10-20 minutes the first time)"
    rc=0; sudo /usr/local/sbin/egpu-bazzite-driver --build || rc=$?
    case $rc in 0) ;; 11) echo "note: Secure Boot is on: at the next reboot choose \"Enroll MOK\" -> Continue -> Yes, password egpubuddy."; DRIVER_FAILED=1 ;;
      *) DRIVER_FAILED=1; echo "warning: the patched driver is not in place (see above)" ;; esac
  fi
elif [ -n "$RO" ]; then
  if [ ! -d /home/.egpu-buddy/sysext ] || ! grep -qx nvidia-open-egpu-615 /etc/nv-egpu-buddy/driver-dir 2>/dev/null; then
    say "== SteamOS: building the patched NVIDIA driver into a system extension on /home (10-20 minutes the first time)"
    sudo bash "$SX" && echo nvidia-open-egpu-615 | sudo tee /etc/nv-egpu-buddy/driver-dir >/dev/null || DRIVER_FAILED=1
  fi
elif command -v pacman >/dev/null 2>&1; then
  if ! pacman -Q nvidia-open-egpu-dkms 2>/dev/null | grep -q "$PKGV\$"; then
    # what the machine had, so an uninstall can put it back (never our own package)
    [ -s /etc/nv-egpu-buddy/nv-prev-packages ] || pacman -Qq 2>/dev/null | grep -xE 'nvidia(-open)?(-dkms|-lts)?|nvidia-utils|lib32-nvidia-utils' \
      | grep -v egpu | paste -sd' ' - | sudo tee /etc/nv-egpu-buddy/nv-prev-packages >/dev/null || true
    say "== building the patched nvidia-open kernel modules (several minutes)"
    EGPU_TARGET_USER="$USER_NAME" bash "$DRVDIR/install-patched-nvidia.sh" || DRIVER_FAILED=1
    echo nvidia-open-egpu-615 | sudo tee /etc/nv-egpu-buddy/driver-dir >/dev/null
  else say "== patched driver package $PKGV already installed"; fi
else
  echo "This system has no supported way to install the patched driver (SteamOS, Bazzite or an Arch-based distro)."; DRIVER_FAILED=1
fi
# eGPU-only driver options must never reach a built-in card (an eGPU install switched to this track left them behind)
for f in egpu-nvidia-autoload-block.conf zz-nvidia-egpu-external.conf nvidia-egpu-hardening.conf zz-nvidia-egpu.conf; do
  [ -e "/etc/modprobe.d/$f" ] && grep -qs egpu "/etc/modprobe.d/$f" && sudo rm -f "/etc/modprobe.d/$f" && echo "removed eGPU-only driver option /etc/modprobe.d/$f"
done
if [ -f /etc/pacman.conf ] && [ -z "$RO" ]; then   # the userspace stays at the patched modules' version (as on every NVIDIA install)
  for pk in nvidia-utils lib32-nvidia-utils opencl-nvidia lib32-opencl-nvidia; do
    grep -qE "^IgnorePkg\s*=.*\b$pk\b" /etc/pacman.conf && continue
    if grep -qE '^IgnorePkg\s*=' /etc/pacman.conf; then sudo sed -i -E "0,/^IgnorePkg\s*=.*/s//& $pk/" /etc/pacman.conf
    else sudo sed -i -E "0,/^#\s*IgnorePkg\s*=.*/s//IgnorePkg = $pk/" /etc/pacman.conf; fi
  done
fi

# ---- system files ---------------------------------------------------------------------------------------------
say "== installing system files"
for f in $SYS_FILES; do
  t=$(mktemp); templ < "$ROOT/system/$f" > "$t"; sudo install -D -m "$(stat -c %a "$ROOT/system/$f")" "$t" "/$f"; rm -f "$t"
done
t=$(mktemp); grep -E '^deck ALL=.*(nv-egpu-buddy-privileged|egpu-report|egpu-buddy-update|egpu-screen)' "$ROOT/system/etc/sudoers.d/zz-steamos-egpu-buddy" | templ > "$t"
sudo install -D -m 0440 "$t" "$SUDOERS"; rm -f "$t"; sudo visudo -cf "$SUDOERS" >/dev/null || { sudo rm -f "$SUDOERS"; echo "warning: sudoers rule rejected"; }
# the self-heal (OS updates, new kernels, the driver load at boot) runs before the login screen, with a time limit
sudo mkdir -p "${SH_DROPIN%/*}"
printf '[Unit]\n# NV GPU Buddy: the driver is loaded here, so the login screen comes after it (or after the time limit)\nBefore=display-manager.service\n[Service]\nTimeoutStartSec=180\nExecStart=\nExecStart=/bin/bash %s/install-nv-gpu-buddy.sh --selfheal\n' "$PERSIST" | sudo tee "$SH_DROPIN" >/dev/null
sudo bash -c "echo '$VER' > /etc/nv-egpu-buddy/version; echo nvidia > /etc/nv-egpu-buddy/gpu-vendor; echo nv-gpu-buddy > '$TRACK_F'
  echo '${MACHINE%% *}' > /etc/nv-egpu-buddy/machine
  [ '$CARD_COMING' = 1 ] && touch /etc/nv-egpu-buddy/card-coming || true
  systemctl daemon-reload >/dev/null 2>&1 || true; systemctl enable egpu-buddy-selfheal.service >/dev/null 2>&1 || true"
if [ -d /etc/atomic-update.conf.d ]; then   # SteamOS: carry our /etc files over OS updates
  printf '/etc/extensions/**\n/etc/sudoers.d/zz-steamos-egpu-buddy\n/etc/nv-egpu-buddy/**\n/etc/systemd/system/egpu-buddy-selfheal.service.d/**\n/etc/pacman.d/gnupg/**\n' | sudo tee /etc/atomic-update.conf.d/egpu-buddy.conf >/dev/null
fi

# ---- user files: NVIDIA settings, their game loader, the Big Art menu fix -------------------------------------------
say "== installing user files"
for f in $USER_FILES; do ucmd mkdir -p "$(dirname "$USER_HOME/$f")"; templ < "$ROOT/user/$f" | ucmd tee "$USER_HOME/$f" >/dev/null; ucmd chmod 755 "$USER_HOME/$f"; done
NVTB="$ROOT/packaging/nvt-shim/build"; ND="$LIBD/nvt"
ucmd mkdir -p "$ND/lib/x86_64-linux-gnu" "$ND/lib/i386-linux-gnu" "$ND/lib64" "$ND/lib32" "$LIBD/steam-ui-fix" "$USER_HOME/.config/egpu-buddy"
for p in lib64 lib/x86_64-linux-gnu; do ucmd cp -f "$NVTB/lib64/libegpu-nvt.so" "$ND/$p/"; done
for p in lib32 lib/i386-linux-gnu; do ucmd cp -f "$NVTB/lib32/libegpu-nvt.so" "$ND/$p/"; done
if [ -e /usr/lib64/libc.so.6 ] && [ ! -L /usr/lib64 ]; then ucmd cp -f "$NVTB/lib32/libegpu-nvt.so" "$ND/lib/"; else ucmd cp -f "$NVTB/lib64/libegpu-nvt.so" "$ND/lib/"; fi
[ -r "$ROOT/packaging/steam-ui-fix/build/libegpu-steam-ui.so" ] && ucmd cp -f "$ROOT/packaging/steam-ui-fix/build/libegpu-steam-ui.so" "$LIBD/steam-ui-fix/"
# what the loader hands every game on this track: NVIDIA's render offload (a laptop's or a motherboard-port screen's games
# go to the NVIDIA card; harmless when the screen is on it) and NVAPI for DLSS. A value set for one game still wins.
printf '# NV GPU Buddy (written by the installer)\n__NV_PRIME_RENDER_OFFLOAD=1\n__VK_LAYER_NV_optimus=NVIDIA_only\n__GLX_VENDOR_LIBRARY_NAME=nvidia\nPROTON_ENABLE_NVAPI=1\nDXVK_ENABLE_NVAPI=1\n' | ucmd tee "$NV_ENV" >/dev/null
# Steam in Game Mode gets the loader. SteamOS / CachyOS handheld edition: Steam is its own unit (steam-launcher.service),
# so gamescope stays stock. gamescope-session-plus (Bazzite, ChimeraOS-style): its per-client hook.
# The Big Art fix only where Steam's interface draws on the NVIDIA card (not a laptop: there it is on the built-in GPU).
# ponytail: LD_PRELOAD here replaces one another tool's drop-in sets for Steam (the Ally case handled in the eGPU session); merge it when a tester has one
UIFIX=1; case "$MACHINE" in nv-laptop*) UIFIX=0 ;; esac
ucmd mkdir -p "${SL_DROPIN%/*}"
{ printf '# NV GPU Buddy: NVIDIA settings for games started by Steam in Game Mode (the loader acts only in games)\n[Service]\nEnvironment=NV_GPU_BUDDY=1\nEnvironment=LD_PRELOAD=%%h/.local/lib/nv-egpu-buddy/nvt/$LIB/libegpu-nvt.so\n'
  [ "$UIFIX" = 1 ] && printf 'ExecStartPre=-/bin/sh -c '"'"'%%h/.local/bin/egpu-steam-ui-fix env | sed -n "s/^export //p" > %%t/nv-gpu-buddy-steam.env'"'"'\nEnvironmentFile=-%%t/nv-gpu-buddy-steam.env\n'
} | ucmd tee "$SL_DROPIN" >/dev/null
if [ -d /usr/share/gamescope-session-plus ] || [ -d "$GSP_HOOK_DIR" ]; then
  ucmd mkdir -p "$GSP_HOOK_DIR"
  for c in steam ogui-steam; do
    if [ ! -e "$GSP_HOOK_DIR/$c" ] || grep -qs 'NV GPU Buddy\|SteamOS EGPU Buddy' "$GSP_HOOK_DIR/$c"; then
      { printf '# NV GPU Buddy: NVIDIA settings for games (the loader acts only in games Steam starts)\nexport NV_GPU_BUDDY=1\nexport LD_PRELOAD="$HOME/.local/lib/nv-egpu-buddy/nvt/\\$LIB/libegpu-nvt.so${LD_PRELOAD:+:$LD_PRELOAD}"\n'
        [ "$UIFIX" = 1 ] && printf 'eval "$("$HOME/.local/bin/egpu-steam-ui-fix" env 2>/dev/null)"\n'; } | ucmd tee "$GSP_HOOK_DIR/$c" >/dev/null
    else echo "note: $GSP_HOOK_DIR/$c is your own file: NV GPU Buddy's game loader was not added to it"; fi
  done
fi
userctl daemon-reload >/dev/null 2>&1 || true

# ---- desktop app (NV GPU Buddy: the same app, its eGPU parts hidden; no Safe Detach launcher) ----------------------
say "== installing the NV GPU Buddy desktop app"
D="$USER_HOME/.local/share/egpu-buddy"; A="$USER_HOME/.local/share/applications"
ucmd mkdir -p "$D" "$USER_HOME/.local/bin" "$A" "$USER_HOME/.config/systemd/user"
for f in egpu-buddy egpu-buddy-server.py egpu-buddy-window.py egpu-buddy.qml index.html egpu-buddy.png; do ucmd cp -f "$ROOT/desktop-app/$f" "$D/"; done
ucmd cp -f "$ROOT/desktop-app/nv-gpu-buddy.png" "$D/egpu-buddy.png"   # NV GPU Buddy keeps its own icon under the shared name
ucmd chmod +x "$D/egpu-buddy" "$D"/*.py; ucmd ln -sf "$D/egpu-buddy" "$USER_HOME/.local/bin/egpu-buddy"
for f in egpu-buddy egpu-buddy-report; do
  sed -e "s#/home/deck#$USER_HOME#g" -e 's/^Name=EGPU Buddy$/Name=NV GPU Buddy/; s/^Name=Save EGPU Buddy report$/Name=Save NV GPU Buddy report/' \
      -e 's/^Comment=NVIDIA eGPU status.*/Comment=NVIDIA GPU status, NVIDIA settings, power and clocks/; s/^GenericName=eGPU /GenericName=GPU /; s/EGPU Buddy logs/NV GPU Buddy logs/' \
      "$ROOT/desktop-app/$f.desktop" | ucmd tee "$A/$f.desktop" >/dev/null
  [ -d "$USER_HOME/Desktop" ] && { ucmd cp -f "$A/$f.desktop" "$USER_HOME/Desktop/$f.desktop"; ucmd chmod +x "$USER_HOME/Desktop/$f.desktop"; }
done
templ < "$ROOT/user/.config/systemd/user/egpu-buddy-tray.service" | ucmd tee "$USER_HOME/.config/systemd/user/egpu-buddy-tray.service" >/dev/null
userctl daemon-reload >/dev/null 2>&1 || true; userctl enable egpu-buddy-tray.service >/dev/null 2>&1 || true

# ---- Decky plugin + the self-heal copy -------------------------------------------------------------------------
# Decky lists the plugin as "NV GPU Buddy" in this mode. Run BY the plugin (a first install or an update from Game Mode,
# EGPU_COMPONENTS without decky): the plugin is already in place, and restarting Decky now would end this very run, so
# only its name changes and Decky restarts a few seconds after this script has finished.
nv_name(){ [ -f "$PLUGIN/plugin.json" ] && sudo python3 -c 'import json,sys; p=sys.argv[1]; j=json.load(open(p)); c=j.get("name")!="NV GPU Buddy"; j["name"]="NV GPU Buddy"; json.dump(j,open(p,"w"),indent=2); sys.exit(0 if c else 1)' "$PLUGIN/plugin.json"; }
if [ -n "${EGPU_COMPONENTS:-}" ] && ! case ",$EGPU_COMPONENTS," in *,decky,*) true;; *) false;; esac; then
  if nv_name; then sudo systemd-run --on-active=8 --collect --quiet systemctl try-restart plugin_loader.service >/dev/null 2>&1 || true; fi
elif [ -d "$USER_HOME/homebrew/plugins" ]; then
  say "== installing the Decky plugin (NV GPU Buddy)"
  sudo rm -rf "$PLUGIN"; sudo mkdir -p "$PLUGIN"
  sudo cp -r "$ROOT/decky-plugin/egpu-buddy/dist" "$ROOT/decky-plugin/egpu-buddy/main.py" "$ROOT/decky-plugin/egpu-buddy/plugin.json" "$ROOT/decky-plugin/egpu-buddy/package.json" "$PLUGIN/"
  [ -d "$ROOT/decky-plugin/egpu-buddy/handhelds" ] && sudo cp -r "$ROOT/decky-plugin/egpu-buddy/handhelds" "$PLUGIN/"
  nv_name || true; sudo chown -R "$USER_NAME" "$PLUGIN"; sudo systemctl restart plugin_loader.service 2>/dev/null || true
else echo "Decky Loader not found (no ~/homebrew/plugins): install Decky, then run this again for the Game Mode plugin"; fi
if [ "$(readlink -f "$ROOT")" != "$(readlink -f "$PERSIST")" ]; then
  say "== keeping a copy of this release in $PERSIST (self-heal source)"
  ucmd mkdir -p "$PERSIST"; rm -rf "${PERSIST:?}"/{system,user,packaging,decky-plugin}
  cp -a "$ROOT"/{system,user,packaging,decky-plugin,install.sh,install-nv-gpu-buddy.sh,uninstall.sh,selfheal.sh,VERSION} "$PERSIST"/ 2>/dev/null || true
  [ "$AS_ROOT" = 1 ] && chown -R "$USER_NAME:$USER_GROUP" "$PERSIST"
fi
sync
if [ "$DRIVER_FAILED" = 1 ]; then say "== NOT finished: the NVIDIA driver was not installed (see above). Run the install again (needs internet)."; exit 20; fi
load_driver
if [ -e /etc/nv-egpu-buddy/card-coming ] && ! lspci -Dn | grep -qE ' 03(00|02): 10de:'; then
  say "== done. The driver is ready: shut down, fit the NVIDIA card, and it is used from the first boot."
else
  say "== done (NV GPU Buddy, experimental). A reboot loads the patched driver."
fi
