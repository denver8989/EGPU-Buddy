#!/usr/bin/env bash
# Other eGPU tools that change what EGPU Buddy changes (primary GPU at boot, the Game Mode session): all-ways-eGPU and
# egpu-switcher. The same detection and removal as the Game Mode plugin (main.py, CONFLICTS / _remove_conflict), for the
# installers that do not go through the plugin: the one-line installer, the .run (graphical or terminal) and install.sh.
#   other-egpu-tools.sh detect   print one line per tool found ("<id> <name>: <evidence>"); exit 0 if any, 1 if none
#   other-egpu-tools.sh remove   (root) each tool's OWN uninstaller first, then only the leftovers that are unmistakably its
set -u
shopt -s nullglob
AWE_BINS=(/usr/bin/all-ways-egpu /usr/local/bin/all-ways-egpu /home/*/bin/all-ways-egpu)
AWE_MARKS=(/etc/all-ways-egpu /etc/systemd/system/all-ways-egpu*.service /etc/udev/rules.d/61-mutter-primary-gpu.rules
           /usr/share/all-ways-egpu /etc/profile.d/all-ways-egpu-user-dir.sh)
SW_BINS=(/usr/bin/egpu-switcher /opt/egpu-switcher /usr/local/bin/egpu-switcher)
SW_MARKS=(/etc/egpu-switcher /etc/X11/xorg.conf.d/99-egpu-switcher.conf /usr/share/egpu-switcher)
awe_overrides(){ local f; for f in /home/*/.config/systemd/user/gamescope-session.service.d/override.conf; do
  grep -qs gamescope-session-egpu "$f" && echo "$f"; done; }
exist(){ local p; for p in "$@"; do [ -e "$p" ] && echo "$p"; done; return 0; }
awe_found(){ exist "${AWE_BINS[@]}" "${AWE_MARKS[@]}"; awe_overrides; }
sw_found(){ exist "${SW_BINS[@]}" "${SW_MARKS[@]}"; }
first_exe(){ local p; for p in "$@"; do [ -x "$p" ] && [ ! -d "$p" ] && { echo "$p"; return 0; }; done; return 1; }

case "${1:-detect}" in
  detect)
    any=1
    e=$(awe_found | head -3 | paste -sd' ' -); [ -n "$e" ] && { echo "all-ways-egpu all-ways-eGPU: $e"; any=0; }
    e=$(sw_found | head -3 | paste -sd' ' -); [ -n "$e" ] && { echo "egpu-switcher egpu-switcher: $e"; any=0; }
    exit $any ;;
  remove)
    [ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
    # SteamOS: /usr is read-only; opened for the removal only, and closed again as it was
    RO=0; command -v steamos-readonly >/dev/null 2>&1 && steamos-readonly status 2>/dev/null | grep -q enabled && { steamos-readonly disable >/dev/null 2>&1 && RO=1; }
    trap '[ "$RO" = 1 ] && steamos-readonly enable >/dev/null 2>&1' EXIT
    if [ -n "$(awe_found)" ]; then
      if exe=$(first_exe "${AWE_BINS[@]}"); then HOME=/root timeout 180 "$exe" uninstall </dev/null >/dev/null 2>&1; echo "all-ways-eGPU: its uninstaller ran (rc=$?)"; fi
      for u in all-ways-egpu all-ways-egpu-boot-vga all-ways-egpu-shutdown all-ways-egpu-set-compositor; do systemctl disable "$u.service" >/dev/null 2>&1; done
      { awe_found; printf '%s\n' /home/*/bin/all-ways-egpu-entry.sh /home/*/bin/gamescope-session-egpu /usr/bin/all-ways-egpu-entry.sh \
          /usr/bin/gamescope-session-egpu /home/*/.config/autostart/all-ways-egpu-reenable.desktop \
          /home/*/.local/share/applications/all-ways-egpu.desktop /usr/share/applications/all-ways-egpu.desktop; } | sort -u |
        while read -r p; do [ -n "$p" ] && [ -e "$p" ] && rm -rf -- "$p" && echo "all-ways-eGPU: removed $p"; done
    fi
    if [ -n "$(sw_found)" ]; then
      if exe=$(first_exe "${SW_BINS[@]}"); then HOME=/root timeout 180 "$exe" disable --hard </dev/null >/dev/null 2>&1; echo "egpu-switcher: disabled (rc=$?)"; fi
      grep -qs egpu-switcher /etc/systemd/system/egpu.service && { systemctl disable egpu.service >/dev/null 2>&1; rm -f /etc/systemd/system/egpu.service; }
      sw_found | while read -r p; do [ -e "$p" ] && rm -rf -- "$p" && echo "egpu-switcher: removed $p"; done
    fi
    systemctl daemon-reload >/dev/null 2>&1; udevadm control --reload >/dev/null 2>&1
    left=$( { awe_found; sw_found; } | head -5 | paste -sd' ' -)
    [ -z "$left" ] && echo "other eGPU tools removed" || { echo "still present: $left"; exit 1; } ;;
  *) echo "usage: other-egpu-tools.sh detect|remove" >&2; exit 64 ;;
esac
