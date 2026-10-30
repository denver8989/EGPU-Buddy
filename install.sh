#!/usr/bin/env bash
# SteamOS-EGPU-Buddy installer core. The graphical front end is installer/steamos-egpu-buddy; this script does the work.
#
#   ./install.sh                 install the default components (core, session, gamescope, decky, bootpolicy)
#   ./install.sh --with-driver   also build + install the patched nvidia-open kernel modules (Arch-based only)
#   ./install.sh --check         only report what differs between this repo and the live system
#   ./install.sh --no-gamescope  skip the GBM-scanout gamescope
#   EGPU_COMPONENTS=core,session,gamescope,decky,bootpolicy,desktopapp,driver   (env) subset to install
#   STOCK_GAMESCOPE_SESSION=/path  (env) the distro's gamescope-session script the wrapper should call
#   EGPU_PREBUILT_GAMESCOPE=dir     (env) prebuilt gamescope tree (usr/bin, usr/share) used when no toolchain is present
#
# Every replaced file is backed up next to itself as <file>.bak-egpu-buddy-<timestamp>.
# Paths that say /home/deck are rewritten to the current user's home; the sudoers rule to the current user.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
TS=$(date +%Y%m%d-%H%M%S)
VER=$(cat "$ROOT/VERSION" 2>/dev/null || echo dev)
# Normal use: run as the login user, sudo is requested for system files. Root use (the Decky plugin's
# "Install system integration"): EGPU_TARGET_USER names the login user; user files are created as that user.
if [ "$(id -u)" = 0 ]; then
  USER_NAME=${EGPU_TARGET_USER:-${SUDO_USER:-}}; [ -n "$USER_NAME" ] && [ "$USER_NAME" != root ] || { echo "running as root: set EGPU_TARGET_USER=<login user>"; exit 1; }
  AS_ROOT=1; sudo(){ "$@"; }
else
  USER_NAME=${SUDO_USER:-$USER}; AS_ROOT=0
fi
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6); USER_UID=$(id -u "$USER_NAME")
userctl(){ if [ "$AS_ROOT" = 1 ]; then runuser -u "$USER_NAME" -- env "XDG_RUNTIME_DIR=/run/user/$USER_UID" "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$USER_UID/bus" systemctl --user "$@"; else systemctl --user "$@"; fi; }
umkdir(){ if [ "$AS_ROOT" = 1 ]; then runuser -u "$USER_NAME" -- mkdir -p "$@"; else mkdir -p "$@"; fi; }
uown(){ [ "$AS_ROOT" = 1 ] && chown -R "$USER_NAME" "$@" 2>/dev/null || true; }
COMPONENTS=${EGPU_COMPONENTS:-core,session,gamescope,decky,bootpolicy,desktopapp}
MODE=install
# --amd: an AMD (or Intel) eGPU. Skips the two NVIDIA-only components - the patched nvidia-open driver
# build, which is the long part of an install, and the GBM-scanout gamescope, which exists only to fix
# the NVIDIA scan-out corruption and does nothing on Mesa. Everything that makes this project useful is
# vendor-neutral and still installed: hot-plug attach, safe detach, surprise-removal recovery, the
# session fallback, audio follow, the Decky plugin and the desktop app.
# Without an explicit choice the install keeps the one made before (/etc/nv-egpu-buddy/gpu-vendor): an update, the boot
# self-heal or a reinstall of an AMD / Intel setup must never build the NVIDIA driver again. --nvidia switches back.
GPU_VENDOR=${EGPU_GPU_VENDOR:-$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null | grep -xE 'nvidia|amd' || echo nvidia)}
for a in "$@"; do case "$a" in --check) MODE=check;; --amd|--no-nvidia) GPU_VENDOR=amd;; --nvidia) GPU_VENDOR=nvidia;; --with-driver) COMPONENTS="$COMPONENTS,driver";; --no-gamescope) COMPONENTS=${COMPONENTS//gamescope/};; *) echo "unknown option $a"; exit 1;; esac; done
# first install from a terminal with no choice made (no flag, no earlier install): ask, as the plugin does
if [ -z "${EGPU_GPU_VENDOR:-}" ] && [ ! -s /etc/nv-egpu-buddy/gpu-vendor ] && [ "${MODE:-install}" = install ] && [ -t 0 ] \
   && ! printf ' %s ' "$@" | grep -qE ' --(amd|no-nvidia|nvidia) '; then
  printf 'Which GPU type will you use?\n  1) NVIDIA (builds the NVIDIA driver, several minutes)\n  2) AMD / Intel (untested; no driver build)\nChoice [1/2]: '
  read -r _c || _c=1; case "$_c" in 2) GPU_VENDOR=amd ;; *) GPU_VENDOR=nvidia ;; esac; echo "-> $GPU_VENDOR"
fi
want(){ case ",$COMPONENTS," in *",$1,"*) return 0;; *) return 1;; esac; }
if [ "$GPU_VENDOR" = amd ]; then
  COMPONENTS=$(printf '%s' "$COMPONENTS" | tr ',' '\n' | grep -vxE 'gamescope|driver' | paste -sd, -)
fi
say(){ printf '\033[1m%s\033[0m\n' "$*"; }

# ---- preflight -----------------------------------------------------------------------------------
say "== preflight ($COMPONENTS)"
. /etc/os-release 2>/dev/null || true
# Bazzite gets its own branches below (gamescope, driver); every other system never enters them
IS_BAZZITE=0; case "${ID:-} ${NAME:-}" in *[Bb]azzite*) IS_BAZZITE=1 ;; esac
if [ "${ID:-}" = steamos ] && [ "$MODE" = install ]; then
  echo "note: SteamOS (experimental): OS updates replace /usr; the self-heal service re-applies this integration at the next boot"
  echo "      from the copy kept in your home, restores cached packages and kernel modules, and rebuilds the driver if headers exist."
fi
for c in systemctl udevadm lspci; do command -v $c >/dev/null || { echo "missing $c"; exit 1; }; done
lspci -Dn | grep -qE '0300: 10de:' || echo "note: no NVIDIA GPU on the bus right now (fine, it is hot-pluggable)"
# runtime tools the scripts call (package names are Arch/SteamOS; Bazzite equivalents are similar)
miss=""; for c in setpci:pciutils modetest:libdrm fuser:psmisc jq:jq xxd:vim perl:perl python3:python qdbus6:qt6-tools kscreen-doctor:libkscreen xprop:xorg-xprop boltctl:bolt nvidia-smi:nvidia-utils; do
  command -v "${c%%:*}" >/dev/null 2>&1 || miss="$miss ${c%%:*}(${c#*:})"; done
[ -z "$miss" ] || echo "warning: missing tools, some paths will degrade:$miss"
STOCK=${STOCK_GAMESCOPE_SESSION:-}; [ -n "$STOCK" ] || for s in /usr/lib/steamos/gamescope-session /usr/bin/gamescope-session /usr/bin/gamescope-session-plus; do [ -f "$s" ] && { STOCK=$s; break; }; done
[ -n "$STOCK" ] || echo "warning: no gamescope-session script found; Game Mode pieces will be inert"
# NVIDIA userspace + driver packages (the hot-plug path loads nvidia-open; nvidia-smi/NVML drive the controls)
# ---- untested hardware: say so, and get an explicit acceptance before anything is installed ----
if [ "$MODE" = install ] && untested=$(bash "$ROOT/system/usr/local/sbin/egpu-detect" --untested 2>/dev/null); then
  echo; echo "*** THIS HARDWARE OR SYSTEM HAS NOT BEEN TESTED WITH SteamOS EGPU Buddy ***"
  printf '%s\n' "$untested" | sed 's/^/    /'
  echo "    Everything here was verified on one machine only (see TESTED.md). On yours it may not work, may leave the"
  echo "    screen dark, or may need a reboot to recover. You install and test it AT YOUR OWN RISK."
  if [ "${EGPU_ACCEPT_UNTESTED:-0}" != 1 ]; then
    if [ -t 0 ]; then read -rp "    Type YES to continue: " r; [ "$r" = YES ] || { echo "aborted"; exit 1; }
    else echo "    (unattended run without EGPU_ACCEPT_UNTESTED=1: aborting)"; exit 1; fi
  fi
  echo
fi
# stock SteamOS ships pacman without an initialised keyring: every package operation then fails ("keyring is not
# writable / required key missing"). Initialise and populate it once (seen on a Legion Go, SteamOS, 2026-09-18).
if [ "$MODE" = install ] && command -v pacman-key >/dev/null 2>&1 && ! sudo pacman-key --list-keys >/dev/null 2>&1; then
  say "== initialising the pacman keyring (first package operation on this system)"
  { sudo pacman-key --init && sudo pacman-key --populate; } >/dev/null 2>&1 || echo "warning: could not initialise the pacman keyring; package steps will fail"
fi
# SteamOS only: the driver step builds everything in a build root on /home, and the distro packages (3.8: 575.64.05,
# ~1.4 GB) neither fit the 5 GB system partition nor match the tested driver. Every other distro keeps its own packages.
# Never on SteamOS: the driver there is our extension on /home; stock packages cannot go into the read-only system (the
# self-heal after an OS update with a new kernel, when nvidia-smi is not there yet, used to try it and fail).
if [ "$GPU_VENDOR" != amd ] && ! command -v steamos-readonly >/dev/null 2>&1 && ! command -v nvidia-smi >/dev/null 2>&1 && command -v pacman >/dev/null 2>&1 && [ "$MODE" = install ]; then
  yes=${EGPU_AUTO_YES:-}; if [ -z "$yes" ] && [ -t 0 ]; then read -rp "NVIDIA packages are missing. Install nvidia-open-dkms + nvidia-utils now with pacman? [y/N] " r; [ "${r,,}" = y ] && yes=1; fi
  if [ "$yes" = 1 ]; then say "== installing nvidia-open-dkms nvidia-utils lib32-nvidia-utils"; sudo pacman -S --needed --noconfirm nvidia-open-dkms nvidia-utils lib32-nvidia-utils || echo "warning: NVIDIA package install failed; install them by hand"; else echo "warning: no nvidia-smi; install nvidia-open-dkms + nvidia-utils before plugging the eGPU in"; fi
fi
# USB4 / Thunderbolt stack: the eGPU arrives over it (AMD USB4 and Intel Thunderbolt share the kernel driver + boltd)
if [ "$MODE" = install ]; then
  if ! command -v boltctl >/dev/null 2>&1 && command -v pacman >/dev/null 2>&1; then say "== installing bolt (Thunderbolt/USB4 device manager)"; sudo pacman -S --needed --noconfirm bolt >/dev/null || echo "warning: could not install bolt"; fi
  sudo modprobe thunderbolt 2>/dev/null || true
  if [ -d /sys/bus/thunderbolt/devices/domain0 ]; then say "== USB4/Thunderbolt controller present ($(cat /sys/bus/thunderbolt/devices/domain0/security 2>/dev/null || echo ?) security level)"
  else echo "WARNING: no USB4/Thunderbolt controller is visible to the kernel. Enable USB4 / Thunderbolt in the firmware (BIOS) settings, then reboot; the eGPU cannot attach without it."; fi
fi
# What counts is whether the parameters are PERSISTED in the bootloader configuration (the running kernel can have them
# from hand-edited entries that the next kernel update regenerates without them). Written but not active = just reboot.
KC="$ROOT/system/usr/local/sbin/egpu-kernel-cmdline"
if bash "$KC" --written >/dev/null 2>&1; then
  bash "$KC" --check >/dev/null 2>&1 || echo "note: the kernel parameters are written; they become active with the next reboot (before plugging the eGPU in)"
else
  # Most people install this with NOTHING plugged in, so "reboot before plugging it in" is not a detail -
  # it is the whole safety story. The protections that stop a cable event taking the machine down (AER
  # handling, ASPM, the Thunderbolt options) are KERNEL PARAMETERS: until the reboot they do not exist,
  # and on an AMD host a PCIe event over the USB4 tunnel can reset the machine outright.
  if [ -z "$(bash "$ROOT/system/usr/local/sbin/egpu-detect" 2>/dev/null)" ]; then
    echo
    echo "  *** DO NOT CONNECT THE eGPU UNTIL YOU HAVE REBOOTED ***"
    echo "      The kernel parameters this install just wrote are what keep a cable event from resetting"
    echo "      the machine. They are not active until the next boot, and no eGPU is connected right now."
    echo
  fi
  echo "note: the eGPU kernel parameters are not in the bootloader configuration yet; this install writes them (backup kept). Reboot BEFORE plugging the eGPU in."
  CMDLINE_MISSING=1
fi

# ---- file map ------------------------------------------------------------------------------------
map_dest(){ case "$1" in system/*) echo "/${1#system/}";; user/*) echo "$USER_HOME/${1#user/}";; esac; }
in_scope(){ # component gating by path
  case "$1" in
    system/usr/local/sbin/egpu-conditional-session|system/etc/systemd/system/egpu-conditional-session.service) want bootpolicy;;
    user/.local/bin/nv-egpu-gamescope-*|user/.local/lib/*|user/.config/systemd/user/gamescope-session.service.d/*|user/.config/systemd/user/steam-launcher.service.d/*|user/.config/gamescope/*|user/.config/environment.d/*|user/.local/bin/egpu-display-profile.sh|user/.local/bin/egpu-kwin-route.sh) want session;;
    *) want core;;
  esac
}
mapfile -t ALL < <(cd "$ROOT" && find system user -type f | sort)
FILES=(); for f in "${ALL[@]}"; do in_scope "$f" && FILES+=("$f"); done

USER_GROUP=$(id -gn "$USER_NAME" 2>/dev/null || echo "$USER_NAME")
# the scripts are written for the SteamOS user "deck"; other distros (CachyOS, Bazzite...) name it differently
# ...and for its UID 1000 (the first user on every handheld distro; only rewritten when this user's differs)
UIDX=(); [ "$USER_UID" = 1000 ] || UIDX=(-e "s|/run/user/1000|/run/user/$USER_UID|g" -e "s|user@1000|user@$USER_UID|g" -e "s|\\bU=1000\\b|U=$USER_UID|g" -e "s|\\buid=1000\\b|uid=$USER_UID|g" \
  -e "s|pgrep -\\([uU]\\) 1000\\b|pgrep -\\1 $USER_UID|g" -e "s|getent passwd 1000\\b|getent passwd $USER_UID|g" -e "s|id -nu 1000\\b|id -nu $USER_UID|g")
# ...and on Bazzite only: its Game Mode is gamescope-session-plus@<client>.service (client steam or ogui-steam), started
# and supervised like SteamOS's gamescope-session.target. The systemctl commands get that unit (a pattern, quoted).
# Bazzite is Fedora: NVIDIA's 64-bit libraries are in /usr/lib64 (32-bit in /usr/lib, Arch's /usr/lib32), and the Vulkan
# driver files are per architecture (nvidia_icd.x86_64.json / .i686.json; Mesa's radeon_icd.x86_64.json likewise).
ICD=/usr/share/vulkan/icd.d
BZX=(); [ "$IS_BAZZITE" = 1 ] && BZX=(
  # every deliberate Game Mode restart (they all reset the shim's crash counter first) also marks itself as ours, so
  # Bazzite's "5 short sessions -> desktop" fallback (packaging/bazzite/egpu-session-env) does not count it
  -e "s#\\(rm -f /run/user/[0-9]*/nv-egpu-buddy-gamescope-starts\\)#\\1 /tmp/chimeraos-short-session-tracker; mkdir -p /run/nvegpu; touch /run/nvegpu/session-restart-ours#g"
  -e "s#\\(systemctl --user [a-z-]* [^|;&>]*\\)gamescope-session\\.target#\\1'gamescope-session-plus@*.service'#g"
  -e "s#\\(VK_[A-Z_]*=\\)$ICD/nvidia_icd\\.json#\\1$ICD/nvidia_icd.x86_64.json:$ICD/nvidia_icd.i686.json#g"
  -e "/^HIDE_LIST=/s#$ICD/nvidia_icd\\.json#$ICD/nvidia_icd.x86_64.json $ICD/nvidia_icd.i686.json#"
  -e "s#$ICD/nvidia_icd\\.json#$ICD/nvidia_icd.x86_64.json#g" -e "/radeon_icd\\.\\(\\*\\|x86_64\\)/!s#$ICD/radeon_icd\\.json#$ICD/radeon_icd.x86_64.json#g"
  -e "s#/usr/lib/libnvidia-ml#/usr/lib64/libnvidia-ml#g" -e "s#/usr/lib32/libnvidia-ml#/usr/lib/libnvidia-ml#g"
  -e "s#/usr/lib/gbm/nvidia-drm_gbm\\.so#/usr/lib64/gbm/nvidia-drm_gbm.so#g")
templ(){ sed "${UIDX[@]}" "${BZX[@]}" -e "s|/home/deck|$USER_HOME|g" -e "s|^deck ALL=|$USER_NAME ALL=|" -e "s|runuser -u deck |runuser -u $USER_NAME |g" -e "s|chown \\(-R \\)\\{0,1\\}deck:deck |chown \\1$USER_NAME:$USER_GROUP |g" -e "s|chown -R deck: |chown -R $USER_NAME: |g" -e "s|^Environment=STOCK_GAMESCOPE_SESSION=.*|Environment=STOCK_GAMESCOPE_SESSION=${STOCK:-/usr/lib/steamos/gamescope-session}|"; }
differs(){ [ -f "$2" ] || return 0; ! cmp -s <(templ < "$ROOT/$1") "$2"; }

if [ "$MODE" = check ]; then
  say "== check (repo vs live)"
  n=0; for f in "${FILES[@]}"; do d=$(map_dest "$f"); if [ ! -r "$(dirname "$d")" ]; then echo "UNREADABLE $d (root-only dir; installed by sudo)"; elif [ ! -e "$d" ]; then echo "MISSING  $d"; n=$((n+1)); elif differs "$f" "$d"; then echo "DIFFERS  $d"; n=$((n+1)); fi; done
  echo "$n file(s) differ or are missing"; exit 0
fi

# ---- SteamOS: a merged driver extension makes ALL of /usr read-only ------------------------------
# On SteamOS /usr/local is part of the system partition (no separate mount), and a merged system extension turns /usr
# into a read-only overlay: a second install then fails with "Read-only file system" (seen on a real device, 0.7.21).
# So: unmerge for the duration of the install, and merge again on EVERY way out. Not while the driver is in use.
# the kept driver's tool: the 610 one re-linked the 610 image on exit, so a kept 615 trial fell back to 610 after every update
SYSEXT_TOOL="$ROOT/packaging/$(cat /etc/nv-egpu-buddy/driver-dir 2>/dev/null || echo nvidia-open-egpu)/install-steamos-sysext.sh"; [ -f "$SYSEXT_TOOL" ] || SYSEXT_TOOL="$ROOT/packaging/nvidia-open-egpu/install-steamos-sysext.sh"
# SteamOS keeps the system partition read-only. The Decky plugin disables that around the install,
# but running this script directly (from the .run, or by hand) did not — it unmerged the driver
# extension, started writing, and failed at the first file with "Read-only file system", leaving a
# half-installed system. Do it here so every route works the same way.
if command -v steamos-readonly >/dev/null 2>&1 && [ "$(steamos-readonly status 2>/dev/null)" = enabled ]; then
  say "== SteamOS: making the system partition writable for the install"
  sudo steamos-readonly disable >/dev/null 2>&1 || true
  trap 'sudo steamos-readonly enable >/dev/null 2>&1 || true' EXIT
fi
if command -v steamos-readonly >/dev/null 2>&1 && grep -q '^sysext /usr ' /proc/mounts 2>/dev/null; then
  # "the driver is loaded" is not the same as "the eGPU is in use". A machine that booted with the
  # eGPU attached has the modules loaded with nothing using them, and refusing there meant the only
  # way to update was to unplug — which on an unprotected port resets the machine. So: if nothing is
  # actually using the eGPU, unload the modules and carry on. If something is, refuse as before.
  if [ -d /sys/module/nvidia ]; then
    _egpu_busy=0
    for _c in /sys/class/drm/card*-*/enabled; do
      [ -e "$_c" ] || continue
      case "${_c#/sys/class/drm/}" in *eDP-*) continue ;; esac
      _cd=$(basename "$(dirname "$_c")"); _cd=${_cd%%-*}
      [ "$(basename "$(readlink -f "/sys/class/drm/$_cd/device/driver" 2>/dev/null)")" = nvidia ] || continue
      [ "$(cat "$_c" 2>/dev/null)" = enabled ] && _egpu_busy=1
    done
    fuser /dev/nvidia* >/dev/null 2>&1 && _egpu_busy=1
    if [ "$_egpu_busy" = 0 ]; then
      say "== the NVIDIA modules are loaded but nothing is using them: unloading so the system files can be written"
      sudo modprobe -r nvidia_drm nvidia_modeset nvidia_uvm nvidia_peermem nvidia >/dev/null 2>&1 || true
    fi
  fi
  if [ -d /sys/module/nvidia ]; then echo "The eGPU is in use, so the system files cannot be written now. The update is STAGED: it installs by itself on the next reboot, before the eGPU is brought up. Nothing to unplug."; exit 21; fi
  say "== SteamOS: unmerging the driver extension while the system files are written"
  sudo systemd-sysext unmerge >/dev/null 2>&1 || { echo "could not unmerge the driver extension (files in use?). Reboot with the eGPU unplugged and run the install again. Nothing was changed."; exit 21; }
  trap 'sudo bash "$SYSEXT_TOOL" --activate >/dev/null 2>&1 || true' EXIT
fi

# ---- AMD / Intel install: undo what an NVIDIA install put in place -------------------------------------------------
# (a machine first set up for NVIDIA by mistake, or switched to an AMD / Intel eGPU). The patched NVIDIA driver and the
# NVIDIA-only gamescope fix are removed; a driver build still running is stopped. The kernel parameters stay: they are
# the USB4 / PCIe settings every eGPU needs (the one NVIDIA option among them does nothing without NVIDIA's driver).
if [ "$GPU_VENDOR" = amd ] && [ "$MODE" = install ]; then
  # A driver build still running is stopped through systemd (its whole unit, cleanly), never by killing processes: on
  # CachyOS the build ends in pacman, and a killed pacman leaves a locked, half-written package database.
  sudo systemctl stop egpu-buddy-driver-build.service egpu-driver-prebuild.service egpu-buddy-driver-repack.service \
    egpu-buddy-bazzite-driver-boot.service >/dev/null 2>&1 || true
  if [ -d /sys/module/nvidia ]; then
    echo "note: the NVIDIA driver is loaded right now (an NVIDIA eGPU attached?): it is left in place; run this install again with it unplugged to remove it"
  else
    # SteamOS: the driver is an extension on /home; taking it out returns /usr to Valve's image exactly
    if [ -d /home/.egpu-buddy ] && [ -f "$SYSEXT_TOOL" ]; then
      say "== AMD / Intel install: removing the NVIDIA driver extension"; sudo bash "$SYSEXT_TOOL" --remove 2>&1 | tail -1
    fi
    # Bazzite: the link goes (the extension is unmerged at the next boot); its files are deleted only once nothing has them
    # merged (deleting under a mounted overlay is unsafe): here if already unmerged, otherwise by the self-heal later
    if [ -x /usr/local/sbin/egpu-bazzite-driver ]; then
      say "== AMD / Intel install: removing the patched NVIDIA driver"
      if sudo /usr/local/sbin/egpu-bazzite-driver --remove 2>&1 | tail -1 && [ ! -L /etc/extensions/egpu-nvidia ]; then
        sudo semodule -r egpu-nvidia-sleep >/dev/null 2>&1
        sudo rm -f /usr/local/sbin/egpu-bazzite-driver /etc/systemd/system/egpu-bazzite-driver-guard.service /etc/systemd/system/egpu-bazzite-boot-ok.service
        sudo systemctl daemon-reload >/dev/null 2>&1 || true
      fi
    fi
    # CachyOS / Arch: never while pacman is working (another install, an update, a build ending in pacman)
    if command -v pacman >/dev/null 2>&1 && pacman -Q nvidia-open-egpu-dkms >/dev/null 2>&1; then
      if [ -e /var/lib/pacman/db.lck ]; then
        echo "note: pacman is busy (another install or update): the NVIDIA driver package is left in place; run this install again when it is done"
      else
        say "== AMD / Intel install: removing the patched NVIDIA driver package"; sudo pacman -R --noconfirm nvidia-open-egpu-dkms 2>&1 | tail -1
      fi
    fi
  fi
  # the NVIDIA-only gamescope fix (Game Mode falls back to the system's own gamescope when it is gone)
  rm -rf "$USER_HOME/.local/gamescope-gbm" 2>/dev/null || sudo rm -rf "$USER_HOME/.local/gamescope-gbm"
  [ "$IS_BAZZITE" = 1 ] && sudo rm -rf /usr/local/lib/egpu-buddy/gamescope-gbm /etc/nv-egpu-buddy/gamescope-wanted 2>/dev/null
  echo "AMD / Intel install: no NVIDIA driver and no NVIDIA gamescope fix on this machine"
fi

# stray copies of the Decky plugin inside homebrew/plugins (update backups of older versions): Decky would run THEM
for d in "$USER_HOME"/homebrew/plugins/EGPU-Buddy.bak*; do [ -d "$d" ] && { sudo rm -rf "$d"; echo "removed stray plugin copy $d"; }; done

# ---- user files ----------------------------------------------------------------------------------
say "== installing user files"
for f in "${FILES[@]}"; do case "$f" in user/*) ;; *) continue;; esac
  d=$(map_dest "$f"); umkdir "$(dirname "$d")"
  # (no backup in Plasma's logout-script folder: Plasma runs every file there, a backup copy too)
  case "$f" in user/.config/plasma-workspace/shutdown/*) ;; *) if [ -e "$d" ] && differs "$f" "$d"; then cp -a "$d" "$d.bak-egpu-buddy-$TS"; fi ;; esac
  templ < "$ROOT/$f" > "$d"; chmod --reference="$ROOT/$f" "$d" 2>/dev/null || true; uown "$d"
done
if want session; then
  chmod +x "$USER_HOME"/.local/bin/nv-egpu-* "$USER_HOME"/.local/bin/egpu-* "$USER_HOME/.local/lib/nv-egpu-buddy/gamescope-shim/gamescope" 2>/dev/null || true
fi

# ---- system files (sudo) -------------------------------------------------------------------------
say "== installing system files (sudo)"
SYS_TMP=$(mktemp -d); n=0
for f in "${FILES[@]}"; do case "$f" in system/*) ;; *) continue;; esac
  d=$(map_dest "$f"); mkdir -p "$SYS_TMP/$(dirname "$d")"; templ < "$ROOT/$f" > "$SYS_TMP/$d"; chmod --reference="$ROOT/$f" "$SYS_TMP/$d" 2>/dev/null || true; n=$((n+1))
done
if [ "$n" -gt 0 ]; then
sudo bash -c "
set -e; TS=$TS
cd '$SYS_TMP'; find . -type f | while read -r f; do d=\"\${f#.}\"; mkdir -p \"\$(dirname \"\$d\")\"; if [ -e \"\$d\" ] && ! cmp -s \"\$f\" \"\$d\"; then cp -a \"\$d\" \"\$d.bak-egpu-buddy-\$TS\"; fi; install -m \"\$(stat -c %a \"\$f\")\" \"\$f\" \"\$d\"; done
rm -f /etc/sudoers.d/steamos-egpu-buddy   # pre-0.7.23 name: sorted BEFORE /etc/sudoers.d/wheel, which then outranked it
rm -f /etc/udev/rules.d/60-egpu-nvidia-powerpin.rules   # pre-0.7.80 name: ran BEFORE 71-nvidia.rules, which set the GPU back to auto
[ -f /etc/sudoers.d/zz-steamos-egpu-buddy ] && { chmod 0440 /etc/sudoers.d/zz-steamos-egpu-buddy; visudo -cf /etc/sudoers.d/zz-steamos-egpu-buddy >/dev/null; }
chmod 0755 /usr/local/sbin/egpu-* /usr/local/sbin/nv-egpu-buddy-* /usr/local/bin/nv-egpu-offset-helper 2>/dev/null || true
[ -x /usr/local/sbin/egpu-dm-session ] && /usr/local/sbin/egpu-dm-session migrate >/dev/null 2>&1
mkdir -p /etc/nv-egpu-buddy /var/lib/nvegpu; rm -f /var/lib/nvegpu/handheld-screen.json; echo '$VER' > /etc/nv-egpu-buddy/version; echo '$GPU_VENDOR' > /etc/nv-egpu-buddy/gpu-vendor
# reloads are conveniences (a reboot applies everything); they have nothing to talk to in a chroot/container
udevadm control --reload >/dev/null 2>&1 || true; udevadm trigger --subsystem-match=pci --action=change >/dev/null 2>&1 || true
systemctl daemon-reload >/dev/null 2>&1 || true
[ -f /etc/systemd/system/egpu-dm-watch.path ] && { { [ \"\$(/usr/local/sbin/egpu-detect --device 2>/dev/null)\" = rog-ally ] || [ -e /var/lib/nvegpu/xg-mobile-seen ]; } && systemctl enable --now egpu-dm-watch.path >/dev/null 2>&1 || systemctl disable --now egpu-dm-watch.path >/dev/null 2>&1; }
[ -f /etc/systemd/system/egpu-amd-presleep.service ] && { [ \"\$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null)\" = amd ] && systemctl enable egpu-amd-presleep.service >/dev/null 2>&1 || systemctl disable egpu-amd-presleep.service >/dev/null 2>&1; }
for u in egpu-mount egpu-boot-enumerate egpu-conditional-session egpu-buddy-selfheal egpu-buddy-resume egpu-buddy-shutdown egpu-driver-trial-boot egpu-decky-guard egpu-flight-recorder; do [ -f /etc/systemd/system/\$u.service ] && systemctl enable \$u.service >/dev/null; done
# watches for the session shim marking the GBM-scanout gamescope as crashing on this OS build (a .path unit, not a .service)
[ -f /etc/systemd/system/egpu-buddy-gamescope-repair.path ] && systemctl enable --now egpu-buddy-gamescope-repair.path >/dev/null 2>&1 || true
[ -f /etc/systemd/system/egpu-driver-prebuild.timer ] && { command -v steamos-readonly >/dev/null 2>&1 || [ '$IS_BAZZITE' = 1 ]; } && systemctl enable --now egpu-driver-prebuild.timer >/dev/null 2>&1 || true
# the session shim (runs as the user) writes its crash mark here, so the folder must be the user's (an older deploy left it root's)
mkdir -p $USER_HOME/.local/state/nv-egpu-buddy && chown $USER_NAME: $USER_HOME/.local/state $USER_HOME/.local/state/nv-egpu-buddy 2>/dev/null || true
systemctl start egpu-decky-guard.service >/dev/null 2>&1 || true
# the flight recorder (read-only timeline for support reports): restart so an update's new version runs now
systemctl restart egpu-flight-recorder.service >/dev/null 2>&1 || true
# the shutdown teardown only acts in its ExecStop: start it now so it already covers the next power-off (no reboot needed)
systemctl start egpu-buddy-shutdown.service >/dev/null 2>&1 || true
# hardware check: undo what an earlier version got wrong on this machine (e.g. a ROG Ally set up with Legion Go 2 addresses)
[ -x /usr/local/sbin/egpu-hw-repair ] && /usr/local/sbin/egpu-hw-repair >/dev/null 2>&1 || true
if [ -f /etc/pacman.conf ]; then
  # pin the NVIDIA userspace to the patched modules' version: append to an existing IgnorePkg line, never replace it
  for pk in nvidia-utils lib32-nvidia-utils opencl-nvidia lib32-opencl-nvidia; do
    grep -qE '^IgnorePkg\\s*=.*\\b'\$pk'\\b' /etc/pacman.conf && continue
    if grep -qE '^IgnorePkg\\s*=' /etc/pacman.conf; then sed -i -E '0,/^IgnorePkg\\s*=.*/s//& '\$pk'/' /etc/pacman.conf; else sed -i -E '0,/^#\\s*IgnorePkg\\s*=.*/s//IgnorePkg = '\$pk'/' /etc/pacman.conf; fi
  done
fi
true
"
fi
rm -rf "$SYS_TMP"
userctl daemon-reload >/dev/null 2>&1 || true   # no user session bus (install at boot, chroot): the next login picks the units up
# helpers already running keep their old code until restarted; this does not touch Game Mode itself
userctl try-restart egpu-wake-guard.service egpu-screen-watch.service egpu-display-failover.service >/dev/null 2>&1 || true
# ROG Ally / XG Mobile: a desktop login pin left behind by an older version (a cable pull on the desktop did not release it,
# 0.7.136) sent every "Return to Gaming Mode" back to the desktop. Released now if nothing needs it (no eGPU attached, no
# Safe Detach running, no boot-desktop opt-in), so the update itself fixes a machine already in that state.
want core && sudo bash -c '{ [ "$(/usr/local/sbin/egpu-detect --device 2>/dev/null)" = rog-ally ] || [ -e /var/lib/nvegpu/xg-mobile-seen ]; } &&
  [ -x /usr/local/sbin/egpu-dm-session ] && /usr/local/sbin/egpu-dm-session release-stale' 2>/dev/null | sed 's/^/login session pin: /' || true
want core && { userctl enable egpu-display-failover.service; userctl enable --now egpu-wake-guard.service; userctl enable --now egpu-screen-watch.service; } >/dev/null 2>&1 || true

# ---- gamescope with GBM scan-out (NVIDIA scan-out corruption fix) --------------------------------
# Bazzite only: Fedora names Qt 6's qdbus qdbus-qt6; the scripts call qdbus6 (and qdbus as a fallback)
if [ "$IS_BAZZITE" = 1 ] && want core; then
  # the desktop compositor gets its GPU routing from a drop-in: Plasma 6.7 never ran the routing script (sluggish desktop)
  umkdir "$USER_HOME/.local/lib/nv-egpu-buddy" "$USER_HOME/.config/systemd/user/plasma-kwin_wayland.service.d"
  templ < "$ROOT/packaging/bazzite/egpu-kwin-env" > "$USER_HOME/.local/lib/nv-egpu-buddy/egpu-kwin-env"; chmod 755 "$USER_HOME/.local/lib/nv-egpu-buddy/egpu-kwin-env"
  templ < "$ROOT/packaging/bazzite/plasma-kwin_wayland-egpu.conf" > "$USER_HOME/.config/systemd/user/plasma-kwin_wayland.service.d/10-egpu-buddy.conf"
  uown "$USER_HOME/.local/lib/nv-egpu-buddy/egpu-kwin-env" "$USER_HOME/.config/systemd/user/plasma-kwin_wayland.service.d"
  userctl daemon-reload >/dev/null 2>&1 || true
  sudo install -m755 "$ROOT/packaging/bazzite/qdbus6" /usr/local/bin/qdbus6
  command -v qdbus >/dev/null 2>&1 || sudo ln -sf qdbus6 /usr/local/bin/qdbus
  # Decky cannot start systemd units on Bazzite: its long jobs (detach, switch, attach) go through this runner instead
  sudo install -m755 "$ROOT/packaging/bazzite/egpu-buddy-jobs" /usr/local/sbin/egpu-buddy-jobs
  sudo install -m644 "$ROOT/packaging/bazzite/egpu-buddy-jobs.path" "$ROOT/packaging/bazzite/egpu-buddy-jobs.service" /etc/systemd/system/
  sudo bash -c 'command -v restorecon >/dev/null && restorecon /usr/local/bin/qdbus6 /usr/local/sbin/egpu-buddy-jobs /etc/systemd/system/egpu-buddy-jobs.* 2>/dev/null
    systemctl daemon-reload; systemctl enable --now egpu-buddy-jobs.path' >/dev/null 2>&1 || true
fi
# Bazzite only: Fedora ships Qt's qml tool only in a -devel package; the desktop app gets a QML runner of its own
if [ "$IS_BAZZITE" = 1 ] && want desktopapp; then
  QR="$ROOT/prebuilt/bazzite-qml-runner/egpu-buddy-qml"
  if [ -x "$QR" ] && ! ldd "$QR" 2>/dev/null | grep -q 'not found'; then sudo install -D -m755 "$QR" /usr/local/lib/egpu-buddy/egpu-buddy-qml
  else echo "note: no QML runner for this Bazzite release; the desktop app opens in the browser instead (no tray icon)"; fi
fi
if want gamescope && [ "$IS_BAZZITE" = 1 ]; then
  # Bazzite only. Its Game Mode is gamescope-session-plus, not SteamOS's gamescope-session: our session wrapper and
  # drop-ins never run there. The NVIDIA picture fix goes in through the session's own per-client config instead.
  # Bazzite's gamescope counts as fixed only if it has the GBM scan-out route itself (its RMDisableNoncontigAlloc
  # driver key is not a verified fix: unproven on a stock driver, and reported to crash games); otherwise ours.
  BZ_GS=/usr/local/lib/egpu-buddy/gamescope-gbm/usr/bin/gamescope
  if grep -qa 'drm_gbm_scanout' /usr/bin/gamescope 2>/dev/null; then
    say "== Bazzite's gamescope has the GBM scan-out fix: using it"; BZ_GS=/usr/bin/gamescope
  else
    # ours from here on: the shim falls back to Bazzite's gamescope while it cannot run, and the repair service builds it
    # for this Bazzite in a Fedora container (after a Bazzite update too)
    sudo bash -c 'mkdir -p /etc/nv-egpu-buddy && touch /etc/nv-egpu-buddy/gamescope-wanted'
  fi
  BZ_TAG=$(/usr/bin/gamescope --version 2>&1 | grep -oE 'gamescope version [^ ]+' | head -1 | awk '{print $3}' | sed 's/+$//')
  if [ "$BZ_GS" = /usr/bin/gamescope ]; then :
  elif [ "$(cat /usr/local/lib/egpu-buddy/gamescope-gbm/BUILT-FROM 2>/dev/null)" = "$BZ_TAG" ] && [ -x "$BZ_GS" ]; then
    say "== the NVIDIA picture fix is already built into this Bazzite's gamescope ($BZ_TAG)"
  elif [ -n "$BZ_TAG" ] && [ "$(cat "$ROOT/prebuilt/bazzite-gamescope-gbm/BUILT-FROM" 2>/dev/null)" = "$BZ_TAG" ] && [ -x "$ROOT/prebuilt/bazzite-gamescope-gbm/usr/bin/gamescope" ] && ! ldd "$ROOT/prebuilt/bazzite-gamescope-gbm/usr/bin/gamescope" 2>/dev/null | grep -q 'not found'; then
    say "== installing the GBM-scanout gamescope built for Bazzite ($(cat "$ROOT/prebuilt/bazzite-gamescope-gbm/BUILD-ID" 2>/dev/null))"
    # atomic swap: a running gamescope keeps the old binary busy (ETXTBSY), so never copy over it in place
    sudo bash -c 'D=/usr/local/lib/egpu-buddy/gamescope-gbm; mkdir -p "$D"; rm -rf "$D/usr.new" "$D/usr.old"; cp -a "$1" "$D/usr.new"
      [ -d "$D/usr" ] && mv "$D/usr" "$D/usr.old"; mv "$D/usr.new" "$D/usr"; rm -rf "$D/usr.old"; cp "$1/../BUILT-FROM" "$1/../BUILD-ID" "$D/"' _ "$ROOT/prebuilt/bazzite-gamescope-gbm/usr"
  else
    # build the fix into THIS Bazzite's gamescope now, in the background (a Fedora container; about 10 minutes); Game Mode
    # uses Bazzite's own gamescope until it is done, then reloads onto it when no game runs
    echo "note: building the NVIDIA picture fix into this Bazzite's gamescope (${BZ_TAG:-?}) in the background"
    sudo bash -c 'mkdir -p /run/nvegpu; j=/run/nvegpu/.egpu-buddy-gamescope-repair.job.tmp
      printf "{\"unit\": \"egpu-buddy-gamescope-repair-%s\", \"log\": \"/tmp/egpu-buddy-gamescope-repair.log\", \"cmd\": [\"/usr/local/sbin/egpu-gamescope-repair\"]}" "$(date +%s)" > "$j"
      systemctl start --no-block egpu-buddy-gamescope-repair.service 2>/dev/null && rm -f "$j" || { mkdir -p /run/nvegpu/jobs; mv "$j" /run/nvegpu/jobs/egpu-buddy-gamescope-repair.job; }' >/dev/null 2>&1 || true
  fi
  # hook: one line per Game Mode client (Bazzite: steam, ogui-steam). A file the user wrote themselves is left alone.
  HK="$USER_HOME/.local/lib/nv-egpu-buddy/bazzite-session-env"; umkdir "$(dirname "$HK")"
  sed "s|@GAMESCOPE@|$BZ_GS|" "$ROOT/packaging/bazzite/egpu-session-env" > "$HK"; uown "$HK"
  # the Game Mode environment older versions wrote at boot into ~/.config/environment.d overrode this hook on Bazzite (read
  # after it) and outlived the eGPU: removed, and taken out of the running user manager (see nv-egpu-buddy-mount)
  EF="$USER_HOME/.config/environment.d/10-egpu-gamescope-output.conf"
  if grep -qs 'NV-EGPU-Buddy - NVIDIA-native Game Mode environment' "$EF"; then
    rm -f "$EF"; userctl unset-environment OUTPUT_CONNECTOR KWIN_DRM_DEVICES VK_DRIVER_FILES VK_ICD_FILENAMES __EGL_VENDOR_LIBRARY_FILENAMES \
      __GLX_VENDOR_LIBRARY_NAME PROTON_ENABLE_NVAPI DXVK_ENABLE_NVAPI PROTON_HIDE_NVIDIA_GPU DXVK_HDR STEAM_DISPLAY_REFRESH_LIMITS >/dev/null 2>&1 || true
  fi
  SD="$USER_HOME/.config/gamescope-session-plus/sessions.d"; umkdir "$SD"
  for c in steam ogui-steam; do
    if [ ! -e "$SD/$c" ] || grep -q 'SteamOS EGPU Buddy' "$SD/$c"; then
      printf '# SteamOS EGPU Buddy: Game Mode on the NVIDIA eGPU screen (changes nothing without one)\n. "%s"\n' "$HK" > "$SD/$c"; uown "$SD/$c"
    elif ! grep -qF "$HK" "$SD/$c"; then
      echo "note: $SD/$c is your own file; add this line to it for Game Mode on the eGPU: . \"$HK\""
    fi
  done
elif want gamescope; then
  PRE=${EGPU_PREBUILT_GAMESCOPE:-$ROOT/prebuilt/gamescope-gbm}
  if [ "$AS_ROOT" = 0 ] && command -v meson >/dev/null && command -v ninja >/dev/null && command -v cc >/dev/null && command -v cmake >/dev/null; then
    say "== building GBM-scanout gamescope from source (a few minutes)"
    HOME="$USER_HOME" "$ROOT/packaging/gamescope-gbm/build.sh" || echo "build failed; the session shim falls back to /usr/bin/gamescope"
  else
    # By DETECTION, not by distro name: take the first shipped build that actually RUNS here (every library resolves).
    # gamescope-gbm = built on CachyOS (needs a recent libstdc++); gamescope-gbm-steamos = built in a SteamOS 3.8 build root.
    # A system neither fits gets a build on the device after the driver step (SteamOS build root), else the distro gamescope.
    PICK=""; for c in "$PRE" "$ROOT"/prebuilt/gamescope-gbm*; do [ -x "$c/usr/bin/gamescope" ] || continue
      ldd "$c/usr/bin/gamescope" 2>/dev/null | grep -q 'not found' || { PICK=$c; break; }; done
    if [ -n "$PICK" ]; then
      say "== installing the prebuilt GBM-scanout gamescope that runs on this system ($(basename "$PICK"))"
      # atomic swap: a running gamescope keeps the old binary busy (ETXTBSY), so never copy over it in place
      G="$USER_HOME/.local/gamescope-gbm"; umkdir "$G"; rm -rf "$G/usr.new" "$G/usr.old"; cp -a "$PICK/usr" "$G/usr.new"
      [ -d "$G/usr" ] && mv "$G/usr" "$G/usr.old"; mv "$G/usr.new" "$G/usr"; rm -rf "$G/usr.old"; uown "$G"
    else
      say "== no shipped gamescope build runs on this system; it is built on the device after the driver step"
      NEED_GAMESCOPE_BUILD=1
    fi
  fi
  # handheld passthrough (opt-in option): the display-GPU side, PyroWave + libxpw. Installed when a shipped build runs
  # here (every library resolves); without it the option says it is not available. Never built on the device.
  for X in "$ROOT"/prebuilt/xpw*; do
    [ -r "$X/libxpw.so" ] && ! ldd "$X/libxpw.so" 2>/dev/null | grep -q 'not found' || continue
    XD="$USER_HOME/.local/lib/nv-egpu-buddy/xpw"; umkdir "$XD"; cp -a "$X"/lib*.so* "$XD/"; uown "$XD"
    say "== installed the handheld passthrough libraries ($(basename "$X"))"; break
  done
fi

# ---- desktop app ----------------------------------------------------------------------------------
if want desktopapp; then
  say "== installing the EGPU Buddy desktop app"
  D="$USER_HOME/.local/share/egpu-buddy"; A="$USER_HOME/.local/share/applications"; umkdir "$D" "$USER_HOME/.local/bin" "$A" "$USER_HOME/.config/autostart"
  cp "$ROOT"/desktop-app/egpu-buddy "$ROOT"/desktop-app/egpu-buddy-server.py "$ROOT"/desktop-app/egpu-buddy-window.py "$ROOT"/desktop-app/egpu-buddy.qml "$ROOT"/desktop-app/index.html "$ROOT"/desktop-app/egpu-buddy.png "$D/"
  chmod +x "$D/egpu-buddy" "$D"/*.py; ln -sf "$D/egpu-buddy" "$USER_HOME/.local/bin/egpu-buddy"
  # menu: the app and "Safely Eject eGPU"; Plasma autostart: the tray icon; desktop folder (when there is one): both launchers
  for f in egpu-buddy egpu-safe-detach egpu-buddy-report; do sed "s#/home/deck#$USER_HOME#g" "$ROOT/desktop-app/$f.desktop" > "$A/$f.desktop"; uown "$A/$f.desktop"
    if [ -d "$USER_HOME/Desktop" ]; then cp "$A/$f.desktop" "$USER_HOME/Desktop/$f.desktop"; chmod +x "$USER_HOME/Desktop/$f.desktop"; uown "$USER_HOME/Desktop/$f.desktop"; fi; done
  # the tray runs as a user service (survives the compositor restarts this project performs); drop the old autostart entry
  rm -f "$USER_HOME/.config/autostart/egpu-buddy-tray.desktop"
  userctl enable egpu-buddy-tray.service >/dev/null 2>&1 || true
  uown "$D" "$USER_HOME/.local/bin/egpu-buddy" "$USER_HOME/.config/autostart/egpu-buddy-tray.desktop"
fi

# ---- Decky plugin --------------------------------------------------------------------------------
if want decky; then
  if [ -d "$USER_HOME/homebrew/plugins" ]; then
    say "== installing the EGPU Buddy Decky plugin"
    sudo rm -rf "$USER_HOME/homebrew/plugins/EGPU-Buddy"; sudo mkdir -p "$USER_HOME/homebrew/plugins/EGPU-Buddy"
    sudo cp -r "$ROOT/decky-plugin/egpu-buddy/dist" "$ROOT/decky-plugin/egpu-buddy/main.py" "$ROOT/decky-plugin/egpu-buddy/plugin.json" "$ROOT/decky-plugin/egpu-buddy/package.json" "$USER_HOME/homebrew/plugins/EGPU-Buddy/"
    sudo chown -R "$USER_NAME" "$USER_HOME/homebrew/plugins/EGPU-Buddy"; sudo systemctl restart plugin_loader.service 2>/dev/null || true
  else
    echo "Decky Loader not found (no ~/homebrew/plugins); skipping the plugin"
  fi
fi

# ---- SteamOS: tell the OS updater which of our /etc files to carry over ---------------------------------------------
# An update keeps /etc/systemd/system/*.service (+ wants) and whatever /etc/atomic-update.conf.d/*.conf lists
# (/usr/lib/rauc/atomic-update-keep.conf on Valve's image). Everything else in /etc is reset.
if [ "$MODE" = install ] && [ -d /etc/atomic-update.conf.d ]; then
  say "== SteamOS: registering the integration's /etc files with the OS updater"
  sudo tee /etc/atomic-update.conf.d/egpu-buddy.conf >/dev/null <<'KEEP'
/etc/extensions/**
/etc/default/grub.d/egpu-buddy.cfg
/etc/udev/rules.d/*egpu*.rules
/etc/modprobe.d/*egpu*.conf
/etc/modules-load.d/egpu-thunderbolt.conf
/etc/sudoers.d/zz-steamos-egpu-buddy
/etc/nv-egpu-buddy/**
/etc/systemd/system/egpu-buddy-gamescope-repair.path
/etc/systemd/system/egpu-driver-prebuild.timer
/etc/systemd/system/egpu-driver-prebuild.service
/etc/pacman.d/gnupg/**
/etc/X11/xorg.conf.d/10-egpu-buddy-builtin-gpu.conf
KEEP
fi

# ---- patched NVIDIA driver (optional, Arch-based) ------------------------------------------------
# the driver this machine runs: 610 (tested) unless a beta driver trial was kept (/etc/nv-egpu-buddy/driver-dir)
DRVDIR="$ROOT/packaging/$(cat /etc/nv-egpu-buddy/driver-dir 2>/dev/null || echo nvidia-open-egpu)"; [ -f "$DRVDIR/PKGBUILD" ] || DRVDIR="$ROOT/packaging/nvidia-open-egpu"
if want driver; then
  PKGV="$(sed -n 's/^pkgver=//p' "$DRVDIR/PKGBUILD")-$(sed -n 's/^pkgrel=//p' "$DRVDIR/PKGBUILD")"
  if [ "$IS_BAZZITE" = 1 ]; then
    # Bazzite: this project's patched driver (modules + NVIDIA's userspace from the same recipes as everywhere else) is
    # built on the device in a Fedora container and merged over the read-only /usr as a system extension
    # (packaging/bazzite/egpu-bazzite-driver). Bazzite's handheld image has no NVIDIA driver of its own.
    BZ=$ROOT/packaging/bazzite
    sudo bash -c 'set -e; L=/usr/local/lib/egpu-buddy/bazzite; mkdir -p "$L/nvidia-open-egpu-615"
      install -m755 "$1/egpu-bazzite-driver" /usr/local/sbin/egpu-bazzite-driver
      install -m644 "$1/fetch-kernel-devel.py" "$1/build-modules.sh" "$1/build-userspace.sh" "$L/"
      install -m644 "$2"/PKGBUILD "$2"/*.patch "$L/nvidia-open-egpu-615/"
      rm -rf "$L/nvidia-open-egpu-615/userspace"; cp -r "$2/userspace" "$L/nvidia-open-egpu-615/userspace"
      # nouveau must never take the eGPU before the patched driver (the driver extension blacklists it once merged;
      # this covers the boot before that, and the kernel parameter the initramfs)
      printf "blacklist nouveau\nblacklist nova_core\nblacklist nova_drm\n" > /etc/modprobe.d/egpu-bazzite-no-nouveau.conf
      install -m644 "$1/egpu-bazzite-driver-guard.service" "$1/egpu-bazzite-boot-ok.service" /etc/systemd/system/; systemctl daemon-reload
      # what the driver package brings on every other system (SteamOS gets it inside its extension): the eGPU hot-plug
      # udev rule + handler and the open-module option. Here in /etc and /usr/local, which udev and modprobe always read.
      install -m755 "$2/nvidia-egpu-hotplug.sh" /usr/local/sbin/nvidia-egpu-hotplug.sh
      sed "s|/usr/lib/nvidia-egpu/nvidia-egpu-hotplug.sh|/usr/local/sbin/nvidia-egpu-hotplug.sh|g" "$2/nvidia-egpu-hotplug.rules" > /etc/udev/rules.d/90-nvidia-egpu-hotplug.rules
      printf "options nvidia NVreg_OpenRmEnableUnsupportedGpus=1\n" > /etc/modprobe.d/egpu-nvidia-open.conf
      # sleep: let systemd-sleep write the driver'"'"'s video-memory file (packaging/bazzite/egpu-nvidia-sleep.cil); loaded live
      command -v semodule >/dev/null && { semodule -l 2>/dev/null | grep -qx egpu-nvidia-sleep && cmp -s "$1/egpu-nvidia-sleep.cil" /usr/local/lib/egpu-buddy/bazzite/egpu-nvidia-sleep.cil || {
        install -m644 "$1/egpu-nvidia-sleep.cil" /usr/local/lib/egpu-buddy/bazzite/egpu-nvidia-sleep.cil
        semodule -i /usr/local/lib/egpu-buddy/bazzite/egpu-nvidia-sleep.cil 2>/dev/null || echo "note: the sleep permission (SELinux) could not be loaded"; }; }
      command -v restorecon >/dev/null && restorecon /usr/local/sbin/egpu-bazzite-driver /usr/local/sbin/nvidia-egpu-hotplug.sh /etc/udev/rules.d/90-nvidia-egpu-hotplug.rules /etc/modprobe.d/egpu-nvidia-open.conf /etc/systemd/system/egpu-bazzite-driver-guard.service /etc/systemd/system/egpu-bazzite-boot-ok.service 2>/dev/null || true
      # a link left by 0.7.146 (merged LIVE under the session) is kept; the counter starts clean
      [ -L /etc/extensions/egpu-nvidia ] && { systemctl enable egpu-bazzite-driver-guard.service egpu-bazzite-boot-ok.service >/dev/null 2>&1; mkdir -p /var/lib/nvegpu/bazzite; echo 0 > /var/lib/nvegpu/bazzite/boot-attempts; } || true
      udevadm control --reload 2>/dev/null || true' _ "$BZ" "$ROOT/packaging/nvidia-open-egpu-615"
    say "== Bazzite: building the patched NVIDIA driver (10-20 minutes the first time: about 1 GB of downloads)"
    sudo /usr/local/sbin/egpu-bazzite-driver --build; brc=$?
    case $brc in
      0) ;;
      11) echo "note: Secure Boot is on. At the next reboot a blue screen (MokManager) appears: choose \"Enroll MOK\" -> Continue -> Yes,"
          echo "      type the password egpubuddy, then Reboot. The patched driver is used from then on."; DRIVER_FAILED=1 ;;
      3) DRIVER_FAILED=1; echo "warning: this Bazzite image carries NVIDIA's driver in another version; use Bazzite's handheld image without NVIDIA (bazzite-deck)." ;;
      *) DRIVER_FAILED=1; echo "warning: the patched driver is not in place on Bazzite (see above). Do NOT connect the eGPU until it is." ;;
    esac
  elif command -v pacman >/dev/null && [ "${EGPU_DRIVER_FORCE:-0}" != 1 ] && pacman -Q nvidia-open-egpu-dkms 2>/dev/null | grep -q "$PKGV\$"; then say "== patched driver package $PKGV already installed (EGPU_DRIVER_FORCE=1 to rebuild)"
  elif command -v steamos-readonly >/dev/null 2>&1; then
    # SteamOS: the system partition has ~870 MB free (measured on Valve's 3.8.14 image) and an update replaces it, so the
    # driver goes into a system extension on /home, built in a SteamOS build root there. Nothing is written to /usr.
    say "== SteamOS: building the patched NVIDIA driver into a system extension on /home (10-20 minutes the first time, mostly downloads)"
    sudo bash "$DRVDIR/install-steamos-sysext.sh" || { DRIVER_FAILED=1; echo "warning: the driver extension was not built (see above); the rest is installed. Do NOT connect the eGPU until it is."; }
  elif command -v pacman >/dev/null; then say "== building the patched nvidia-open kernel modules (several minutes)"; EGPU_TARGET_USER="$USER_NAME" "$DRVDIR/install-patched-nvidia.sh" || echo "warning: patched driver build failed; the stock driver stays (safe detach works, cable yank may hang)"; else echo "the patched driver package needs pacman (Arch-based distro); skipping"; fi
else
  # Do not cry wolf: on SteamOS the patched driver is delivered as a system extension, not as a
  # pacman package, so "no package" says nothing about whether it is installed. The modules
  # themselves are the proof — they carry strings only this project's patches add, which is the
  # same test the privileged helper uses before it will load the display stack. Telling a user with
  # a correctly patched driver that a cable yank might hang their compositor is worse than saying
  # nothing: they stop trusting what the software reports.
  if modinfo -n nvidia >/dev/null 2>&1 &&
     { f=$(modinfo -n nvidia 2>/dev/null); case "$f" in
         *.zst) zstd -dcq "$f" 2>/dev/null ;; *.xz) xz -dcq "$f" 2>/dev/null ;;
         *.gz) gzip -dcq "$f" 2>/dev/null ;; *) cat "$f" 2>/dev/null ;; esac; } |
     grep -qaF 'External GPU disconnected.'; then
    say "== the installed NVIDIA modules are this project's patched build (surprise unplug is handled)"
  else
    say "== patched driver not installed. Without it a cable yank can hang the compositor (safe detach still works)."
  fi
fi

# ---- gamescope built on the device (only when no shipped build runs here; needs the SteamOS build root from the driver step)
if [ "${NEED_GAMESCOPE_BUILD:-0}" = 1 ]; then
  if [ "${EGPU_DEFER_GAMESCOPE_BUILD:-0}" = 1 ]; then
    # the self-heal runs this at BOOT, before the login screen: a 10-15 minute build there is a 10-15 minute black screen.
    # It hands the build to egpu-gamescope-repair instead, which runs in the background and reloads Game Mode when done.
    say "== the GBM-scanout gamescope build is left to the background repair (not built during boot)"
  elif [ -x /home/.egpu-buddy/buildroot/usr/bin/makepkg ]; then
    say "== building the GBM-scanout gamescope on this device (10-15 minutes, one time)"
    sudo bash "$ROOT/packaging/gamescope-gbm/build-steamos.sh" "$USER_NAME" || echo "warning: gamescope build failed; Game Mode on the eGPU will use the distro gamescope (picture corruption on NVIDIA above ~2560 px wide)"
  else echo "warning: no gamescope build for this system and no build environment; the distro gamescope is used (picture corruption on NVIDIA above ~2560 px wide)"; fi
fi

# ---- persistent payload + caches (what the self-heal service repairs from after an OS update) --------------
PERSIST="$USER_HOME/.local/share/steamos-egpu-buddy"
if [ "$(readlink -f "$ROOT")" != "$(readlink -f "$PERSIST")" ]; then
  say "== keeping a copy of this release in $PERSIST (self-heal source)"
  umkdir "$PERSIST"; rm -rf "$PERSIST"/{system,user,packaging,prebuilt,desktop-app,decky-plugin,docs,installer}
  cp -a "$ROOT"/{system,user,packaging,desktop-app,decky-plugin,docs,installer,install.sh,uninstall.sh,selfheal.sh,VERSION,README.md,TESTED.md,CREDITS.md,LICENSE} "$PERSIST"/ 2>/dev/null || true
  [ -d "$ROOT/prebuilt" ] && cp -a "$ROOT/prebuilt" "$PERSIST"/
fi
if command -v pacman >/dev/null 2>&1; then
  umkdir "$PERSIST/pkgcache" "$PERSIST/modcache/$(uname -r)"
  # cache the exact installed versions for an offline restore: pacman cache -> our build dir -> Arch Linux Archive
  for pk in nvidia-utils lib32-nvidia-utils bolt dkms nvidia-open-egpu-dkms; do v=$(pacman -Q "$pk" 2>/dev/null | awk '{print $2}' || true); [ -n "$v" ] || continue   # not installed (stock SteamOS) must not abort the install
    ls "$PERSIST"/pkgcache/"$pk"-"$v"-*.pkg.tar.* >/dev/null 2>&1 && continue
    f=$( { ls /var/cache/pacman/pkg/"$pk"-"$v"-*.pkg.tar.* "$USER_HOME"/.cache/egpu-buddy/driver-build/"$pk"-"$v"-*.pkg.tar.* 2>/dev/null || true; } | grep -v '\.sig$' | head -1 || true)
    if [ -n "$f" ]; then cp -n "$f" "$PERSIST/pkgcache/" 2>/dev/null || true
    else for arch in x86_64 any; do curl -fsSL -o "$PERSIST/pkgcache/$pk-$v-$arch.pkg.tar.zst" "https://archive.archlinux.org/packages/${pk:0:1}/$pk/$pk-$v-$arch.pkg.tar.zst" 2>/dev/null && break; rm -f "$PERSIST/pkgcache/$pk-$v-$arch.pkg.tar.zst"; done; fi
  done
  ls /usr/lib/modules/"$(uname -r)"/updates/dkms/nvidia*.ko* >/dev/null 2>&1 && cp -a /usr/lib/modules/"$(uname -r)"/updates/dkms/nvidia*.ko* "$PERSIST/modcache/$(uname -r)/" 2>/dev/null || true
fi
uown "$PERSIST"
if [ "${CMDLINE_MISSING:-0}" = 1 ]; then
  yes=${EGPU_AUTO_YES:-}; if [ -z "$yes" ] && [ -t 0 ]; then read -rp "Write the missing kernel parameters into the bootloader configuration now? (backup kept) [y/N] " r; [ "${r,,}" = y ] && yes=1; fi
  if [ "$yes" = 1 ]; then say "== writing the kernel parameters"; sudo /usr/local/sbin/egpu-kernel-cmdline --apply || echo "warning: could not write the kernel parameters; see docs/TECHNICAL.md 'Kernel command line'"; fi
fi
# SteamOS has no NVIDIA driver of its own: without the extension the eGPU cannot work at all, so this is not a "done"
if [ "${DRIVER_FAILED:-0}" = 1 ]; then say "== NOT finished: the NVIDIA driver was not built. Keep the eGPU unplugged and run the install again (needs internet)."; exit 20; fi
# Flush everything to disk before saying "done". A machine that hard-resets shortly after an install
# (a fabric flood gives no warning) came back with a ZERO-BYTE privileged helper and boot script: the
# files had been written but never reached the disk, and an empty script "succeeds" at everything —
# so no protection was applied and no driver was loaded, with nothing in any log to say why.
sync
# A reboot is asked for only when one is really needed: kernel parameters written but not yet active, or (Bazzite) a
# patched driver that could not be added to the running system and switches on at the next boot. Everything else
# (scripts, udev rules, services, the SteamOS driver extension, a DKMS module loaded at attach) works right away.
if ! /usr/local/sbin/egpu-kernel-cmdline --check >/dev/null 2>&1; then
  say "== done. One reboot activates the kernel parameters (eGPU unplugged until then). Read TESTED.md before relying on any of this."
elif [ "$IS_BAZZITE" = 1 ] && [ "$GPU_VENDOR" != amd ] && [ -z "${DRIVER_FAILED:-}" ] && want driver && ! sudo /usr/local/sbin/egpu-bazzite-driver --status >/dev/null 2>&1; then
  say "== done. The patched driver switches on with the next reboot. Read TESTED.md before relying on any of this."
else
  say "== done. No reboot needed: plug the eGPU in. Read TESTED.md before relying on any of this."
fi
