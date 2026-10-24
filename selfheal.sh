#!/bin/bash
# SteamOS EGPU Buddy self-heal. Runs as root at boot (egpu-buddy-selfheal.service; unit in /etc, script here in
# /home: both survive an OS update that replaces /usr). If the root-side integration is missing or outdated it is
# re-applied from this payload; pacman packages and kernel modules are restored from the caches kept here.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); VER=$(cat "$HERE/VERSION" 2>/dev/null || echo dev)
USER_NAME=$(stat -c %U "$HERE"); log(){ logger -t egpu-buddy-selfheal "$*"; echo "$*"; }
# in /var/log, not /tmp: /tmp is emptied at every reboot, and "why did the eGPU stop working after the update" is asked
# after a reboot. Kept small: the previous log is kept as .1 once it passes 1 MB.
SLOG=/var/log/egpu-buddy-selfheal.log
[ "$(stat -c %s "$SLOG" 2>/dev/null || echo 0)" -gt 1048576 ] && mv -f "$SLOG" "$SLOG.1"
echo "=== $(date '+%F %T') self-heal (payload $VER, kernel $(uname -r)) ===" >> "$SLOG"
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
ro=$(command -v steamos-readonly || true)
# Older plugin versions kept their update backup INSIDE homebrew/plugins; Decky loads every folder there as a plugin and ran
# the backup (= the old version) instead of the updated one. Remove such copies at every boot and reload Decky if any existed.
UH=$(getent passwd "$USER_NAME" | cut -d: -f6); stray=0
for d in "$UH"/homebrew/plugins/EGPU-Buddy.bak*; do [ -d "$d" ] && { rm -rf "$d"; stray=1; log "removed stray plugin copy $d"; }; done
[ "$stray" = 1 ] && systemctl try-restart plugin_loader.service >/dev/null 2>&1
need=0
[ -x /usr/local/sbin/nv-egpu-buddy-privileged ] && [ -x /usr/local/sbin/egpu-hotplug-mount.sh ] || need=1
[ "$(cat /etc/nv-egpu-buddy/version 2>/dev/null)" = "$VER" ] || need=1
[ "${SELFHEAL_FORCE:-0}" = 1 ] && need=1
if [ $need = 1 ]; then
  # This is also how a STAGED update lands: the plugin unpacks a newer payload here when the eGPU
  # was in use and /usr/local could not be written, and the versions then differ at the next boot.
  # Nothing is displaying yet at this point, so there is no session to disturb and nothing to unplug.
  log "root integration missing or outdated (have '$(cat /etc/nv-egpu-buddy/version 2>/dev/null)', payload $VER): installing"
  [ -n "$ro" ] && $ro disable >/dev/null 2>&1
  if command -v pacman >/dev/null 2>&1 && [ -d "$HERE/pkgcache" ]; then
    for p in "$HERE"/pkgcache/*.pkg.tar.*; do [ -f "$p" ] || continue
      n=$(basename "$p" | sed -E 's/-[^-]+-[^-]+-[^-]+\.pkg\.tar\..*$//'); pacman -Q "$n" >/dev/null 2>&1 || { log "restoring package $n"; pacman -U --noconfirm --ask 4 "$p" >/dev/null 2>&1 || log "failed: $n"; }
    done
  fi
  EGPU_TARGET_USER=$USER_NAME EGPU_AUTO_YES=1 EGPU_COMPONENTS=core,session,gamescope,bootpolicy,desktopapp EGPU_PREBUILT_GAMESCOPE="$HERE/prebuilt/gamescope-gbm" \
    EGPU_ACCEPT_UNTESTED=1 EGPU_DEFER_GAMESCOPE_BUILD=1 bash "$HERE/install.sh" >>$SLOG 2>&1 && log "repair done" || log "repair reported errors (see $SLOG)"
  [ -n "$ro" ] && $ro enable >/dev/null 2>&1
fi
# SteamOS: the driver is a system extension on /home (the 5 GB system partition cannot hold it). Re-activate it now;
# when the OS update brought a new kernel, rebuild the modules for it in the background (needs the network, minutes).
DRVDIR="$HERE/packaging/$(cat /etc/nv-egpu-buddy/driver-dir 2>/dev/null || echo nvidia-open-egpu)"; [ -f "$DRVDIR/PKGBUILD" ] || DRVDIR="$HERE/packaging/nvidia-open-egpu"   # 610 unless a beta trial was kept
SX="$DRVDIR/install-steamos-sysext.sh"
if [ -n "$ro" ] && [ -x "$SX" ] && [ -d /home/.egpu-buddy ]; then
  if bash "$SX" --activate >>$SLOG 2>&1; then log "driver extension active"
    # same kernel, different OS: the NVIDIA userspace in the image may not fit the new OS any more. Re-pack it in the
    # background (offline, about a minute: the modules are already built). The current image stays active meanwhile.
    if ! bash "$SX" --host-check >>$SLOG 2>&1; then
      log "OS changed since the driver extension was packed: re-packing it in the background"
      systemd-run --quiet --collect --unit=egpu-buddy-driver-repack --property=TimeoutStartSec=3600 --setenv=EGPU_DEFER_SWAP=1 \
        /bin/bash -c "bash '$SX' >>$SLOG 2>&1" || log "could not start the re-pack"
    fi
  else
    log "driver extension has no modules for $(uname -r): rebuilding in the background"
    # The network wait accepts ANY HTTP answer: the package server's front page answers 401, and with curl -f that counted
    # as offline, so every boot waited the full 20 minutes before building (seen on a Legion Go 1 after SteamOS 3.8.28).
    systemd-run --quiet --collect --unit=egpu-buddy-driver-build --property=TimeoutStartSec=5400 /bin/bash -c \
      "for i in \$(seq 1 40); do curl -sI -o /dev/null --max-time 8 https://steamdeck-packages.steamos.cloud/ 2>/dev/null && break; sleep 30; done; EGPU_DEFER_SWAP=1 bash '$SX' --boot >>$SLOG 2>&1; \
       # the eGPU may have been plugged in WHILE the driver was building: the attach hook refused it \
       # then, and the user should not have to unplug and replug to finish what is now possible. \
       if modinfo -n nvidia >/dev/null 2>&1 && lspci -Dn 2>/dev/null | grep -qE '0300: 10de:'; then \
         echo 'driver build finished with an eGPU connected: attaching' >>$SLOG; \
         /usr/local/sbin/egpu-hotplug-mount.sh >>$SLOG 2>&1; fi" \
      || log "could not start the background rebuild"
  fi
fi
# patched driver package: restore from cache (done above) or rebuild from the payload's PKGBUILD (source cached)
if [ -z "$ro" ] && command -v pacman >/dev/null 2>&1 && ! pacman -Q nvidia-open-egpu-dkms >/dev/null 2>&1 && [ -x "$DRVDIR/install-patched-nvidia.sh" ] && [ -f "/usr/lib/modules/$(uname -r)/build/Makefile" ]; then
  log "patched driver package missing: rebuilding from the payload"; [ -n "$ro" ] && $ro disable >/dev/null 2>&1
  EGPU_TARGET_USER=$USER_NAME bash "$DRVDIR/install-patched-nvidia.sh" >>$SLOG 2>&1 && log "driver package rebuilt" || log "driver rebuild failed (see $SLOG)"
  [ -n "$ro" ] && $ro enable >/dev/null 2>&1
fi
# kernel modules for the running kernel: DKMS rebuild if possible, else the cached modules of this exact kernel
K=$(uname -r)
if [ -z "$ro" ] && [ ! -x /usr/local/sbin/egpu-bazzite-driver ] && [ "$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null)" != amd ] && { ! modinfo -n nvidia >/dev/null 2>&1 || [ ! -f "/usr/lib/modules/$K/updates/dkms/nvidia.ko.zst" ]; }; then   # not on SteamOS/Bazzite: their extension carries the modules
  if command -v dkms >/dev/null 2>&1 && [ -f "/usr/lib/modules/$K/build/Makefile" ]; then
    log "no patched modules for $K: dkms autoinstall"; [ -n "$ro" ] && $ro disable >/dev/null 2>&1; dkms autoinstall -k "$K" >/dev/null 2>&1 && log "dkms built for $K" || log "dkms build failed for $K"; [ -n "$ro" ] && $ro enable >/dev/null 2>&1
  elif [ -d "$HERE/modcache/$K" ]; then
    log "no headers for $K: restoring cached modules"; [ -n "$ro" ] && $ro disable >/dev/null 2>&1
    mkdir -p "/usr/lib/modules/$K/updates/dkms" && cp -a "$HERE/modcache/$K"/nvidia*.ko* "/usr/lib/modules/$K/updates/dkms/" && depmod -a "$K" && log "modules restored for $K"
    [ -n "$ro" ] && $ro enable >/dev/null 2>&1
  else
    log "no patched NVIDIA modules for kernel $K and no way to build or restore them; the eGPU will not attach on this kernel"
  fi
fi
# SteamOS: the GBM-scanout gamescope (the NVIDIA picture-corruption fix) must still run on this OS. If it cannot, or it
# kept crashing on this OS build, rebuild it in the background: egpu-gamescope-repair decides, builds at most once per OS
# build, and reloads Game Mode onto it when no game is running. Never in the boot path: the build takes 10-15 minutes.
# (Bazzite too: there it is rebuilt in a Fedora container after a Bazzite update it no longer fits)
if { [ -n "$ro" ] || grep -qsiE '^(ID|NAME)="?bazzite' /etc/os-release; } && [ -x /usr/local/sbin/egpu-gamescope-repair ] && /usr/local/sbin/egpu-gamescope-repair --needed >>$SLOG 2>&1; then
  systemctl start --no-block egpu-buddy-gamescope-repair.service >/dev/null 2>&1 && log "GBM-scanout gamescope needs a rebuild for this OS: started in the background"
fi
# Bazzite, switched to the AMD / Intel install: the old NVIDIA driver files, deleted once nothing has them merged
if [ "$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null)" = amd ] && [ -d /var/lib/nvegpu/bazzite ] && [ ! -L /etc/extensions/egpu-nvidia ] \
   && ! systemd-sysext status 2>/dev/null | grep -qw egpu-nvidia; then
  rm -rf /var/lib/nvegpu/bazzite && log "removed the old NVIDIA driver files (AMD / Intel install)"
  rm -f /usr/local/sbin/egpu-bazzite-driver /etc/systemd/system/egpu-bazzite-driver-guard.service /etc/systemd/system/egpu-bazzite-boot-ok.service
fi
# Bazzite only (the tool exists only there): patched NVIDIA modules for a new kernel, a staged build taking over
# In the BACKGROUND: this service runs before the login screen, and a build takes 10-20 minutes (0.7.146 ran it here and
# held the boot at the logo). The boot guard already decided before the merge whether the build matches this boot.
[ -x /usr/local/sbin/egpu-bazzite-driver ] && { systemd-run --no-block --collect --quiet --unit=egpu-buddy-bazzite-driver-boot \
  --property=Wants=network-online.target --property=After=network-online.target \
  /usr/local/sbin/egpu-bazzite-driver --boot >/dev/null 2>&1 && log "bazzite driver: boot check started in the background"; }
# kernel parameters (bootloader config may have been regenerated)
/usr/local/sbin/egpu-kernel-cmdline --repair 2>&1 | while read -r l; do log "kernel parameters: $l"; done
if grep -qsiE '^(ID|NAME)="?bazzite' /etc/os-release; then
  # Bazzite: rpm-ostree writes a whole new deployment and waits on its daemon (which may be busy updating at boot), so it
  # never runs in the boot path, and not at all when the parameters are already written and only wait for a reboot
  /usr/local/sbin/egpu-kernel-cmdline --check >/dev/null 2>&1 || /usr/local/sbin/egpu-kernel-cmdline --pending >/dev/null 2>&1 \
    || { systemd-run --no-block --collect --quiet --unit=egpu-buddy-kargs-boot /usr/local/sbin/egpu-kernel-cmdline --apply >/dev/null 2>&1 \
         && log "kernel parameters missing: being written in the background; reboot needed"; }
elif ! /usr/local/sbin/egpu-kernel-cmdline --check >/dev/null 2>&1; then
  /usr/local/sbin/egpu-kernel-cmdline --apply >/dev/null 2>&1 && log "kernel parameters re-applied; reboot needed" || log "kernel parameters missing and could not be written"
fi
exit 0
