# nvidia-open-egpu (NV-EGPU-Buddy build)

Patched `nvidia-open` kernel modules for surprise eGPU disconnect on Linux, built from the AUR
`nvidia-open-egpu` recipe (PR #985 hot-unplug + PR #984 `RmForceExternalGpu`, rebased by their author
for the exact driver version) plus two NV-EGPU-Buddy fixes needed when a compositor drives a display
on the eGPU:

- `165-…defer-modeconfig-cleanup-on-removal.patch` — never tear down the DRM mode config while clients
  still hold it; the managed DRM cleanup runs at release.
- `166-…software-commit-during-removal.patch` — atomic commits become software no-ops once the device
  is being removed, so the compositor's framebuffers can be freed and the modules unload.

Patch order: 110 120 130 140 160 170 165 166 (as in PKGBUILD). Build: `makepkg -s`; install the `-dkms`
package (or the prebuilt one for the running kernel). It provides/conflicts `nvidia-open-dkms`, so a
`pacman -Syu` cannot silently replace it; `nvidia-utils` must stay at the same version (pinned via
IgnorePkg on this machine). Runtime: `options nvidia NVreg_RegistryDwords="RmForceExternalGpu=1"`.
Do NOT enable the AUR package's own `nvidia-egpu-hotplug.rules` — NV-EGPU-Buddy's `98-egpu-surprise-remove.rules`
+ `egpu-surprise-recover` handle the removal (override with an empty /etc/udev/rules.d/90-nvidia-egpu-hotplug.rules).
Verified 2026-09-11 with a real cable yank (RTX 5060 Ti, TB5, Strix Halo, kernel 7.1.8, 610.57.04).

## 180-nvidia-open-dp-cec-over-aux.patch (not wired in yet)

HDMI-CEC through a DisplayPort-to-HDMI adapter that tunnels CEC over AUX (the kernel's drm_dp_cec helper), which
nvidia-drm never hooked up: a kernel-only NVKMS ioctl + KAPI call for native AUX (the RM control nvkms already uses
for DPCD), a drm_dp_aux per SST DisplayPort connector, drm_dp_cec register / set_edid / unset_edid, a 100 ms poll for
the CEC IRQ bit (no DP short-pulse reaches nvidia-drm), and AUX refused once the card is being removed (the
inRemoval / inSurpriseRemoval flags of 165/166) so a Safe Detach or cable pull can't crash in the CEC teardown.
Off unless `nvidia_drm.dp_cec=1`. Builds on 610.57.04, 615.78.08 (this file) and 620.70.06 (its own copy: 620
dropped the disp handle from GetPerOpenConnector). Not in the PKGBUILDs yet: untested on hardware (needs a CEC-capable
active DP-to-HDMI adapter), and adding it to the patch list rebuilds the driver for every NVIDIA install.
