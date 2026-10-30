#!/bin/bash
# EGPU Buddy: Plasma runs this when the desktop session ends, before the login manager picks the next session.
# SteamOS with the NVIDIA install only (ROG Ally / XG Mobile first, every SteamOS machine since 0.7.197 at the owner's
# request); everywhere else (Bazzite, CachyOS, the AMD / Intel install) it exits at once and changes nothing.
# Why: on the desktop with the eGPU attached, EGPU Buddy pins the next login to the desktop (zzs-egpu-buddy-session.conf),
# so a cable pull that kills the desktop brings the desktop back instead of Game Mode. SteamOS 3.9.5's "Return to Gaming
# Mode" writes no login setting at all: it just logs out and lets the system default (Game Mode) apply - which the pin
# outranked, so it came straight back to the desktop (ROG Xbox Ally X + XG Mobile, report on 0.7.195; the login-change log
# shows nothing written). A logout with the NVIDIA eGPU still alive and no EGPU Buddy job running is the user leaving the
# desktop: the pin goes, and the system's own choice applies. A cable pull (the card is gone) and EGPU Buddy's own
# relogins (attach, Safe Detach, desktop detach, recovery) keep it.
command -v steamos-readonly >/dev/null 2>&1 || exit 0
[ "$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null)" = amd ] && exit 0
# the pin's name: zzs- on a ROG Ally / XG Mobile, zzz- on every other SteamOS machine (egpu-dm-session)
[ -f /etc/sddm.conf.d/zzs-egpu-buddy-session.conf ] || [ -f /etc/sddm.conf.d/zzz-egpu-buddy-session.conf ] || exit 0
pgrep -f '/usr/local/sbin/(egpu-hotplug-mount\.sh|egpu-safe-detach|egpu-desktop-detach|egpu-surprise-recover|egpu-gamemode-switch)' >/dev/null 2>&1 && exit 0
[ -e /run/nvegpu/gm-detach-pending ] && exit 0
alive=0
for d in /sys/bus/pci/devices/*; do
  [ "$(cat "$d/vendor" 2>/dev/null)" = 0x10de ] || continue
  case "$(cat "$d/class" 2>/dev/null)" in 0x0300*|0x0302*) ;; *) continue ;; esac
  # a config-space read reaches the card itself: a card that is gone answers ffff
  [ "$(od -An -tx2 -N2 "$d/config" 2>/dev/null | tr -d ' ')" = 10de ] && alive=1
done
[ "$alive" = 1 ] || exit 0
timeout 5 sudo -n /usr/local/sbin/nv-egpu-buddy-privileged session-fallback game >/dev/null 2>&1 &&
  logger -t egpu-buddy "desktop logout with the eGPU attached (Return to Gaming Mode): the desktop login pin was released, the system default (Game Mode) applies" 2>/dev/null
exit 0
