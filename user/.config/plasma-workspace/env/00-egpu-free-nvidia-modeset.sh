#!/bin/bash
# ~/.config/plasma-workspace/env/00-egpu-free-nvidia-modeset.sh
# Sourced by startplasma(-wayland) BEFORE the compositor (kwin_wayland) starts.
#
# THIS FILE IS WHAT MAKES THE DESKTOP RUN ON THE eGPU ALONE. A session restart cannot inherit the routing any other way:
# KWin reads KWIN_DRM_DEVICES at startup, and the user manager's environment does not reliably survive a logout (on SteamOS
# it did not, and the desktop came back extended across both GPUs). Everything below is detected - GPUs by PCI vendor,
# cards and render nodes by sysfs, the panel connector via EGPU_PANEL_CONNECTOR - so it is not tied to one machine.
#
# GAME MODE -> DESKTOP BLACK-SCREEN FIX
# On the gamescope -> Plasma handoff with the eGPU attached, Steam
# (steamwebhelper) can still be ALIVE holding /dev/nvidia-modeset when KWin tries
# to start on the RTX 3080 -> "Failed to allocate NvKmsKapiDevice" -> black
# desktop -> SDDM timeout -> bounce back to Game Mode (user then had to reboot
# WITHOUT the eGPU to reach Desktop). steamos-session-select's `plasma` branch
# only fires an ASYNC `steam -shutdown` and does not wait, so the modeset device
# may not be free in time.
#
# Here, in the pre-compositor phase of EVERY Plasma start, we make sure Steam is
# fully gone (modeset released) BEFORE KWin starts. Strictly gated + time-capped:
#   * no-op unless the eGPU is physically present AND Steam is actually alive
#   * caps the blocking wait so it can never hang the session
#   * logs to the same file as the display autostart for one-shot post-mortem
# Steam is relaunched after login by ~/.config/autostart/steam.desktop, so this
# only moves its shutdown earlier in the handoff — it does not remove Steam.
# Only run in KDE Plasma session.
# Bazzite: Plasma runs these scripts BEFORE it sets XDG_CURRENT_DESKTOP=KDE itself (startplasma.cpp: runEnvironmentScripts()
# precedes setupPlasmaEnvironment()), so the check above depends on what the login manager passed. On Bazzite this script
# left no trace at all while the desktop came up on both GPUs (KWin holding the AMD card next to the NVIDIA one: the
# sluggish desktop, Legion Go 2 report on 0.7.178). Only startplasma sources this directory, so there it always runs.
_egpu_bz=0; grep -qsiE '^(ID|NAME)="?bazzite' /etc/os-release && _egpu_bz=1
if [ "$_egpu_bz" = 0 ] && [ "${XDG_CURRENT_DESKTOP:-}" != "KDE" ] && [ "${XDG_SESSION_DESKTOP:-}" != "KDE" ]; then
  exit 0
fi

_egpu_log="$HOME/.egpu-desktop-display.log"
_egpu_emlog() { printf '%s [env] %s\n' "$(date '+%F %T')" "$*" >> "$_egpu_log"; }
# NVIDIA's Vulkan driver file: SteamOS / CachyOS name it nvidia_icd.json, Fedora (Bazzite) per architecture. Where the plain
# name exists nothing changes; the per-architecture names are used only where it does not (the check below used to fail
# there: "NVIDIA userspace files missing; leaving KWin default" = KWin on both GPUs).
_egpu_nv_icd=/usr/share/vulkan/icd.d/nvidia_icd.json
[ -r "$_egpu_nv_icd" ] || _egpu_nv_icd=$(ls /usr/share/vulkan/icd.d/nvidia_icd.x86_64.json /usr/share/vulkan/icd.d/nvidia_icd.i686.json 2>/dev/null | paste -sd: -)

_egpu_detect_nvidia_gpu_bdf() {
  local dev vendor class card
  for dev in /sys/bus/pci/devices/*; do
    [ -r "$dev/vendor" ] || continue
    vendor=$(cat "$dev/vendor" 2>/dev/null || true)
    [ "$vendor" = "0x10de" ] || continue
    class=$(cat "$dev/class" 2>/dev/null || true)
    case "$class" in
      0x030000|0x030200)
        for card in "$dev"/drm/card*; do
          [ -e "$card" ] || continue
          basename "$dev"
          break
        done
        ;;
    esac
  done | sort -V | head -n 1
}

_egpu_card_for_pci() {
  local pci=$1 card
  [ -n "$pci" ] || return 1
  for card in /sys/bus/pci/devices/"$pci"/drm/card*; do
    [ -e "$card" ] || continue
    printf '/dev/dri/%s\n' "${card##*/}"
    return 0
  done
  return 1
}

_egpu_render_for_card() {
  local card=${1##*/} r
  for r in /sys/class/drm/"$card"/device/drm/renderD*; do [ -e "$r" ] && { printf '/dev/dri/%s\n' "${r##*/}"; return 0; }; done
  return 1
}
_egpu_panel_pci() {
  local panel=${EGPU_PANEL_CONNECTOR:-eDP-1} node dev
  for node in /sys/class/drm/card*-"$panel"; do
    [ -e "$node/status" ] || continue
    dev=$(readlink -f "$node/device/device" 2>/dev/null || true)
    [ -n "$dev" ] || continue
    basename "$dev"
    return 0
  done
  return 1
}

_egpu_detect_amd_gpu_bdf() {
  local dev vendor class card
  for dev in /sys/bus/pci/devices/*; do
    [ -r "$dev/vendor" ] || continue
    vendor=$(cat "$dev/vendor" 2>/dev/null || true)
    [ "$vendor" = "0x1002" ] || continue
    class=$(cat "$dev/class" 2>/dev/null || true)
    case "$class" in
      0x030000|0x030200)
        for card in "$dev"/drm/card*; do
          [ -e "$card" ] || continue
          basename "$dev"
          break
        done
        ;;
    esac
  done | sort -V | head -n 1
}

_egpu_connected_outputs_for_pci() {
  local pci=$1 panel=${EGPU_PANEL_CONNECTOR:-eDP-1} node base output device
  [ -n "$pci" ] || return 1
  for node in /sys/class/drm/card*-*; do
    [ -e "$node/status" ] || continue
    [ "$(cat "$node/status" 2>/dev/null)" = "connected" ] || continue
    [ -s "$node/modes" ] || continue
    base=${node##*/}
    output=$(printf '%s\n' "$base" | sed -E 's/^card[0-9]+-//')
    [ -n "$output" ] || continue
    [ "$output" != "$panel" ] || continue
    case "$output" in
      Writeback-*) continue ;;
    esac
    device=$(readlink -f "$node/device/device" 2>/dev/null || true)
    case "$device" in
      */"$pci") printf '%s\n' "$output" ;;
    esac
  done | sort -u
}

_egpu_stage_desktop_kwin() {
  local egpu_pci egpu_card igpu_pci igpu_card outputs kwin_devices

  if [ -e "$HOME/.config/nv-egpu-buddy/disable-desktop-kwin-routing" ]; then
    _egpu_emlog "Plasma pre-compositor: NVIDIA-first KWin disabled by user flag"
    return 0
  fi
  # DETACH MODE: pin KWin to the iGPU ONLY so it never opens the eGPU card.
  # egpu-noauto alone is NOT enough: "KWin default" still enumerates every DRM
  # device and mmaps card0, which makes egpu_detach.sh's gate-b guard refuse the
  # PCI-remove. egpu-safe-detach sets this flag, restarts the session, then removes.
  if [ -n "${XDG_RUNTIME_DIR:-}" ] && [ -e "$XDG_RUNTIME_DIR/egpu-detach-mode" ]; then
    local _dm_pci _dm_card
    _dm_pci=${IGPU_PCI:-$(_egpu_panel_pci || _egpu_detect_amd_gpu_bdf)}
    _dm_card=$(_egpu_card_for_pci "$_dm_pci" || true)
    if [ -n "$_dm_card" ]; then
      export KWIN_DRM_DEVICES="$_dm_card"
      export KWIN_RENDER_NODES="$(_egpu_render_for_card "$_dm_card")"   # KWin 6.7: never open the NVIDIA render node on the iGPU session
      # Also move RENDERING off NVIDIA. Without this KWin still opens /dev/nvidia0 and
      # /dev/nvidia-modeset via the NVIDIA EGL/Vulkan stack, pinning nvidia_drm's
      # refcount so the display modules cannot be unloaded and removal is refused.
      export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json
      export __GLX_VENDOR_LIBRARY_NAME=mesa
      for _dm_icd in /usr/share/vulkan/icd.d/radeon_icd.json /usr/share/vulkan/icd.d/radeon_icd.x86_64.json \
                     /usr/share/vulkan/icd.d/radeon_icd.i686.json; do
        [ -r "$_dm_icd" ] && { export VK_DRIVER_FILES="$_dm_icd" VK_ICD_FILENAMES="$_dm_icd"; break; }
      done
      unset PROTON_ENABLE_NVAPI DXVK_ENABLE_NVAPI PROTON_HIDE_NVIDIA_GPU
      _egpu_emlog "Plasma pre-compositor: DETACH MODE -> KWin pinned to iGPU only ($_dm_card), render stack = mesa"
    else
      _egpu_emlog "Plasma pre-compositor: DETACH MODE set but no iGPU card resolved"
    fi
    return 0
  fi

  if [ -n "${XDG_RUNTIME_DIR:-}" ] && [ -e "$XDG_RUNTIME_DIR/egpu-noauto" ]; then
    _egpu_emlog "Plasma pre-compositor: egpu-noauto is set; leaving KWin default"
    return 0
  fi
  # AMD / Intel install: an eGPU with a screen on it (Game Mode was on it): the desktop starts there too, as the plug-in
  # path does (egpu-generic: eGPU first, the handheld's GPU kept so the panel can be switched off; the screen watcher makes
  # that screen the only one). Before, Game Mode -> Desktop left KWin on its defaults: the desktop came up on the handheld
  # and the TV stayed on, black (Legion Go S + RX 9070 XT, report LUJVV7).
  if [ "$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null)" = amd ]; then
    local _a_pp _a_dev _a_card _a_ic
    _a_pp=$(_egpu_panel_pci || true)
    for _a_dev in /sys/bus/pci/devices/*; do
      [ "${_a_dev##*/}" = "$_a_pp" ] && continue
      case "$(cat "$_a_dev/vendor" 2>/dev/null)" in 0x1002|0x8086) ;; *) continue ;; esac
      case "$(cat "$_a_dev/class" 2>/dev/null)" in 0x030000|0x038000) ;; *) continue ;; esac
      [ -n "$(_egpu_connected_outputs_for_pci "${_a_dev##*/}")" ] || continue
      _a_card=$(_egpu_card_for_pci "${_a_dev##*/}" || true); _a_ic=$(_egpu_card_for_pci "$_a_pp" || true)
      if [ -n "$_a_card" ] && [ -n "$_a_ic" ]; then
        export KWIN_DRM_DEVICES="$_a_card:$_a_ic" DRI_PRIME="pci-$(printf '%s' "${_a_dev##*/}" | tr ':.' '__')!"
        _egpu_emlog "Plasma pre-compositor: AMD / Intel eGPU ${_a_dev##*/} has a screen -> KWIN_DRM_DEVICES=$KWIN_DRM_DEVICES"
        return 0
      fi
    done
  fi
  if [ ! -r "${_egpu_nv_icd%%:*}" ] || [ ! -r /usr/share/glvnd/egl_vendor.d/10_nvidia.json ]; then
    _egpu_emlog "Plasma pre-compositor: NVIDIA userspace files missing; leaving KWin default"
    return 0
  fi

  egpu_pci=${EGPU_PCI_BDF:-$(_egpu_detect_nvidia_gpu_bdf)}
  egpu_card=$(_egpu_card_for_pci "$egpu_pci" || true)
  outputs=$(_egpu_connected_outputs_for_pci "$egpu_pci" | paste -sd, -)

  # eGPU outputs (or their DRM modes) can enumerate a few seconds AFTER this
  # pre-compositor phase when booting WITH the eGPU attached, so we'd otherwise
  # bail and KWin would start on AMD -> the USB4 cross-GPU crosstalk. If the NVIDIA
  # GPU is physically present but no output is ready yet, wait a bounded few
  # seconds for one. (Does NOT help hotplug-AFTER-login: the compositor is already
  # up on AMD by then and can't be rerouted live -> that case needs a re-login.)
  # Dockless boot is unchanged: no NVIDIA GPU -> no wait -> bails immediately.
  # Wait if the NVIDIA GPU is present but EITHER its DRM card node OR a connected output
  # isn't ready yet (both enumerate a few seconds after this phase on hotplug/boot-with-eGPU).
  # Previously only waited on outputs, so a not-yet-ready card node bailed instantly -> KWin on AMD.
  if [ -n "$egpu_pci" ] && { [ -z "$egpu_card" ] || [ -z "$outputs" ]; }; then
    local _waited=0 _max=${EGPU_KWIN_STAGE_WAIT:-8}
    while [ "$_waited" -lt "$_max" ]; do
      sleep 1; _waited=$((_waited + 1))
      egpu_card=$(_egpu_card_for_pci "$egpu_pci" || true)
      outputs=$(_egpu_connected_outputs_for_pci "$egpu_pci" | paste -sd, -)
      if [ -n "$egpu_card" ] && [ -n "$outputs" ]; then
        _egpu_emlog "Plasma pre-compositor: NVIDIA card+output ready after ${_waited}s wait"
        break
      fi
    done
  fi

  if [ -z "$egpu_pci" ] || [ -z "$egpu_card" ]; then
    # NVIDIA card ABSENT (never attached, safe-detached, or SURPRISE-yanked): the user-manager env may still
    # carry the last NVIDIA-first staging (KWIN_DRM_DEVICES=cardN + nvidia EGL) -> KWin would fail to open the
    # node and the relaunched session goes black. Pin explicitly to the iGPU + mesa instead.
    local _ab_pci _ab_card
    _ab_pci=${IGPU_PCI:-$(_egpu_panel_pci || _egpu_detect_amd_gpu_bdf)}
    _ab_card=$(_egpu_card_for_pci "$_ab_pci" || true)
    if [ -n "$_ab_card" ]; then
      export KWIN_DRM_DEVICES="$_ab_card"
      export KWIN_RENDER_NODES="$(_egpu_render_for_card "$_ab_card")"   # KWin 6.7: never open the NVIDIA render node on the iGPU session
      export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json
      export __GLX_VENDOR_LIBRARY_NAME=mesa
      for _ab_icd in /usr/share/vulkan/icd.d/radeon_icd.json /usr/share/vulkan/icd.d/radeon_icd.x86_64.json /usr/share/vulkan/icd.d/radeon_icd.i686.json; do
        [ -r "$_ab_icd" ] && { export VK_DRIVER_FILES="$_ab_icd" VK_ICD_FILENAMES="$_ab_icd"; break; }
      done
      unset PROTON_ENABLE_NVAPI DXVK_ENABLE_NVAPI PROTON_HIDE_NVIDIA_GPU
      _egpu_emlog "Plasma pre-compositor: NVIDIA card absent -> KWin pinned to iGPU only ($_ab_card), render stack = mesa"
      # ROG Ally / XG Mobile: with no eGPU left to lose, a desktop login pin still in place (left by a cable pull, an
      # interrupted detach, an older version) only sends "Return to Gaming Mode" back here. Release it now; the helper
      # keeps it while a Safe Detach runs or when the user chose to boot into the desktop.
      if { [ "$(/usr/local/sbin/egpu-detect --device 2>/dev/null)" = rog-ally ] || [ -e /var/lib/nvegpu/xg-mobile-seen ]; }; then
        _egpu_emlog "Plasma pre-compositor: login pin check: $(sudo -n /usr/local/sbin/nv-egpu-buddy-privileged session-fallback release-stale 2>&1 | head -1)"
      fi
    else
      _egpu_emlog "Plasma pre-compositor: NVIDIA card absent and no iGPU card resolved; leaving KWin default"
    fi
    return 0
  fi
  # The handheld's own screen (or a screen on its USB-C port, e.g. XR glasses) picked as THE screen, in the Game Mode plugin
  # or the desktop app (/var/lib/nvegpu/game-screen): the desktop starts there too, as Game Mode does. KWin on the handheld's
  # GPU only (no second GPU in the compositor = no crosstalk), games through Vulkan on the eGPU, NVAPI on. Before this the
  # desktop always went to the eGPU monitor, whatever was picked (Legion Go 2 + RTX 5060 Ti, CachyOS, 0.7.216).
  local _hh_pref _hh_card _hh_pcard
  _hh_pref=$(cat /var/lib/nvegpu/game-screen 2>/dev/null)
  _hh_pcard=$(basename "$(ls -d /sys/class/drm/card[0-9]*-"${EGPU_PANEL_CONNECTOR:-eDP-1}" 2>/dev/null | head -1)"); _hh_pcard=${_hh_pcard%%-*}
  igpu_pci=${IGPU_PCI:-$(_egpu_panel_pci || _egpu_detect_amd_gpu_bdf)}
  igpu_card=$(_egpu_card_for_pci "$igpu_pci" || true)
  # (the NVIDIA reference path; Bazzite routes its desktop its own way, unchanged. ROG Ally / XG Mobile: only the glasses
  # case, a screen on the handheld's USB-C picked, so the desktop runs on the eGPU as Game Mode passthrough does; before,
  # the desktop fell to "KWin default" on the Ally's GPU (ROG Xbox Ally X + XG Mobile 2025 + XREAL, report 4D5H3B).
  # Its own handheld screen keeps the Ally's own desktop routing, unchanged.)
  local _hh_ally=0
  { [ "$(/usr/local/sbin/egpu-detect --device 2>/dev/null)" = rog-ally ] || [ -e /var/lib/nvegpu/xg-mobile-seen ]; } && _hh_ally=1
  # the Ally glasses case: Wayland desktops only (SteamOS's X11 desktop is the Ally's own, on its own GPU)
  if [ "$_egpu_bz" = 0 ] && { [ "$_hh_ally" = 0 ] || { [ "${XDG_SESSION_TYPE:-wayland}" != x11 ] && case "$_hh_pref" in eDP-*|"") false ;; *) true ;; esac; }; } &&
     [ -n "$_hh_pref" ] && [ -n "$igpu_card" ] && [ -n "$_hh_pcard" ] &&
     { case "$_hh_pref" in eDP-*) true ;; *) [ "$(cat "/sys/class/drm/$_hh_pcard-$_hh_pref/status" 2>/dev/null)" = connected ] ;; esac; }; then
    case "$_hh_pref" in
      eDP-*)
        export KWIN_DRM_DEVICES="$igpu_card"
        export KWIN_RENDER_NODES="$(_egpu_render_for_card "$igpu_card")"
        export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json
        export __GLX_VENDOR_LIBRARY_NAME=mesa ;;
      *)
        # a screen on the handheld's USB-C (XR glasses) picked: as in Game Mode, the eGPU keeps rendering the desktop and the
        # handheld only carries the picture to the glasses: KWin on the eGPU first, the handheld's GPU second (its outputs
        # get the eGPU's frames). Picking an eGPU screen again starts the eGPU-only desktop (full speed, eDP console lifeboat).
        if [ -n "${egpu_card:-}" ]; then
          export KWIN_DRM_DEVICES="$egpu_card:$igpu_card"
          export KWIN_RENDER_NODES="$(_egpu_render_for_card "$egpu_card")"
          export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json
          export __GLX_VENDOR_LIBRARY_NAME=nvidia DXVK_HDR=0
        else
          export KWIN_DRM_DEVICES="$igpu_card"
          export KWIN_RENDER_NODES="$(_egpu_render_for_card "$igpu_card")"
          export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json
          export __GLX_VENDOR_LIBRARY_NAME=mesa
        fi ;;
    esac
    export VK_DRIVER_FILES="$_egpu_nv_icd" VK_ICD_FILENAMES="$_egpu_nv_icd"
    export PROTON_ENABLE_NVAPI=1 DXVK_ENABLE_NVAPI=1 PROTON_HIDE_NVIDIA_GPU=0
    [ -n "${XDG_RUNTIME_DIR:-}" ] && printf '%s\n' "$_hh_pref" > "$XDG_RUNTIME_DIR/egpu-desktop-handheld" 2>/dev/null
    _egpu_emlog "Plasma pre-compositor: screen picked = $_hh_pref (handheld) -> KWIN_DRM_DEVICES=$KWIN_DRM_DEVICES, games on the eGPU (Vulkan $_egpu_nv_icd)"
    return 0
  fi
  [ -n "${XDG_RUNTIME_DIR:-}" ] && rm -f "$XDG_RUNTIME_DIR/egpu-desktop-handheld"
  if [ -z "$outputs" ]; then
    _egpu_emlog "Plasma pre-compositor: NVIDIA card present but no connected external output; leaving KWin default"
    return 0
  fi

  igpu_pci=${IGPU_PCI:-$(_egpu_panel_pci || _egpu_detect_amd_gpu_bdf)}
  igpu_card=$(_egpu_card_for_pci "$igpu_pci" || true)
  kwin_devices="$egpu_card"
  # NVIDIA-ONLY by default (2026-07-02): appending the iGPU put AMD inside the session -> multi-GPU
  # sync overhead + USB4 copyback (the user-visible degradation), AND a KWin-mastered AMD card blocks
  # the fbcon VT-lifeboat on surprise removal. AMD now stays UNMASTERED: zero crosstalk + the kernel
  # console (getty@tty3 / emergency-console) remains available on eDP as the yank escape hatch.
  # Legacy NVIDIA-first-with-AMD: touch ~/.config/nv-egpu-buddy/kwin-include-igpu
  if [ -e "$HOME/.config/nv-egpu-buddy/kwin-include-igpu" ] && [ -n "$igpu_card" ]; then
    kwin_devices="$kwin_devices:$igpu_card"
    _egpu_emlog "Plasma pre-compositor: kwin-include-igpu flag set -> appending $igpu_card"
  fi

  export KWIN_DRM_DEVICES="$kwin_devices"
  export KWIN_RENDER_NODES="$(_egpu_render_for_card "$egpu_card")"   # NVIDIA render node only (no AMD crosstalk, no stale iGPU pin)
  export VK_DRIVER_FILES="$_egpu_nv_icd"
  export VK_ICD_FILENAMES="$_egpu_nv_icd"
  export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json
  export __GLX_VENDOR_LIBRARY_NAME=nvidia
  export PROTON_ENABLE_NVAPI=1
  export DXVK_ENABLE_NVAPI=1
  export PROTON_HIDE_NVIDIA_GPU=0
  export DXVK_HDR=0  # 2026-08-21 was re-enabling HDR on eGPU desktop -> gamescope HDR corruption (NVIDIA bug 5240452)
  unset __NV_PRIME_RENDER_OFFLOAD __VK_LAYER_NV_optimus DRI_PRIME

  _egpu_emlog "Plasma pre-compositor: NVIDIA-first KWin staged for $outputs using KWIN_DRM_DEVICES=$KWIN_DRM_DEVICES"
}

# SAFETY NET: a Vulkan driver pin that names a file which no longer exists makes the loader report "Found no drivers",
# and then NOTHING that uses Vulkan starts — not a game, not the compositor. That state can be left behind by any detach
# (the NVIDIA ICD is hidden while the card is away) or by an older version of this software. Repair it at session start.
for _v in VK_DRIVER_FILES VK_ICD_FILENAMES; do
  eval "_p=\${$_v:-}"
  if [ -n "${_p:-}" ] && [ ! -r "${_p%%:*}" ]; then
    unset "$_v"; systemctl --user unset-environment "$_v" >/dev/null 2>&1 || true
    logger -t egpu-buddy "repaired stale $_v (pointed at ${_p%%:*}, which does not exist)" 2>/dev/null || true
  fi
done
unset _v _p

_egpu_pci=${EGPU_PCI_BDF:-$(_egpu_detect_nvidia_gpu_bdf)}
_egpu_stage_desktop_kwin
# NVIDIA settings (experimental): only when this desktop's games render on the NVIDIA eGPU (Vulkan pinned to it above)
_nvt=""
case "${VK_DRIVER_FILES:-}" in
  *nvidia_icd*)
    if [ -x "$HOME/.local/bin/egpu-nvidia-tweaks" ]; then _nvt=$(timeout 10 "$HOME/.local/bin/egpu-nvidia-tweaks" env 2>/dev/null) || _nvt=""; fi ;;
esac
if [ -n "$_nvt" ]; then
  eval "$_nvt" 2>/dev/null || true
  _egpu_emlog "NVIDIA settings: $(printf '%s\n' "$_nvt" | sed 's/^export //; s/=.*//' | tr '\n' ' ')" || true
fi
unset _nvt

if [ -n "$_egpu_pci" ] && [ -e "/sys/bus/pci/devices/$_egpu_pci" ] && { pgrep -x steamwebhelper >/dev/null 2>&1 || pgrep -x steam >/dev/null 2>&1; }; then
  _egpu_emlog "Plasma pre-compositor: eGPU present + Steam alive -> freeing /dev/nvidia-modeset before KWin"
  /usr/bin/steam -shutdown >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    pgrep -x steamwebhelper >/dev/null 2>&1 || pgrep -x steam >/dev/null 2>&1 || break
    sleep 0.5
  done
  if pgrep -x steamwebhelper >/dev/null 2>&1 || pgrep -x steam >/dev/null 2>&1; then
    _egpu_emlog "Steam still alive after ~15s -> SIGKILL backstop"
    pkill -9 -x steamwebhelper 2>/dev/null || true
    pkill -9 -x steam 2>/dev/null || true
    sleep 1
  fi
  _egpu_emlog "Steam down; /dev/nvidia-modeset should now be free for KWin"
fi
unset _egpu_pci _egpu_log _egpu_nv_icd _egpu_bz
unset -f _egpu_render_for_card _egpu_emlog _egpu_detect_nvidia_gpu_bdf _egpu_card_for_pci _egpu_panel_pci _egpu_detect_amd_gpu_bdf _egpu_connected_outputs_for_pci _egpu_stage_desktop_kwin 2>/dev/null || true
