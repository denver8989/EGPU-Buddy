# nvidia-open-egpu for 620.70.06 (BETA, untested on hardware)

The nine patches of `../nvidia-open-egpu-615/` (615.78.08, EGPU Buddy's main driver since 0.7.220) ported to the open
kernel modules 620.70.06, same order: 110 120 130 140 160 170 165 166 167. Offered as the beta driver to machines that run
615; a machine on 610 is offered 615 first.

## What had to change (everything else applies unchanged, line content identical to 615)
- **160 hotplug**, five places re-done by hand (`fix160.py` in the port notes below):
  - `nv-acpi.c` `nv_acpi_notify_event`: only a comment word changed in 620 ("GPS" became "PRH"); the hunk itself is the same.
  - `nvkms.c`: 620 removed per-display handles, and with them `GetPerOpenDevAndDisp()`, where the patch rejected late
    display ioctls on a lost GPU. The same check now sits in a new `GetPerOpenDevForDisp()`, used by exactly the six ioctls
    that went through `GetPerOpenDevAndDisp()` on 615: set cursor image, set LUT, query CRC32, and enable / disable /
    accelerate the vblank semaphore controls. In 620 they call `GetPerOpenDev()` and then read `pOpenDev->pDevEvo`, which the
    patch sets to NULL when the GPU is lost; without the check that would be a NULL dereference after a cable pull.
  - `osinit.c` `RmShutdownAdapter`: 620 added an `else` branch (TDISP DSM-only boot) after `gpuStateUnload`; it is kept,
    and the two asserts are replaced by warnings as before.
  - `kernel_gsp_tu102.c`: 620 runs FWSEC-SB through `kvbiosExecuteFwsecSbCmd_HAL()` instead of `kgspExecuteFwsec_HAL()`;
    a lost GPU is not an error there either, as before.
  - `nv.c` (close path, added by the patch): 620 renamed `NV_IS_DEVICE_IN_SURPRISE_REMOVAL()` to
    `NV_IS_DEVICE_INACCESSIBLE()`, which also covers PCIe error recovery. The patch tests the surprise-removal flag itself,
    so it means exactly what it meant on 615.
- **160 hotplug, nvidia-drm surprise-removal branch**: 620 fixed a race in its own unload (event handling is switched off
  under `nv_dev->lock` first, then the workers are cancelled) and added a content-protection worker. The patch's
  surprise-removal branch now follows the same order and also cancels that new worker; otherwise it could run after the
  device is gone.
- **165 / 166 / 167, 110-140, 170**: unchanged, refreshed to 620's line numbers (every patch applies with no offset or fuzz).

## Checked (2026-11-05)
- Every patch applies to NVIDIA's own source tarball exactly (no offset, no fuzz); the PKGBUILD checksums match.
- Every added/removed line compared against the 615 patches: the only differences are the edits listed above.
- All five modules (nvidia, nvidia-modeset, nvidia-drm, nvidia-uvm, nvidia-peermem) compile and link against
  SteamOS `linux-neptune-618` 6.18.53 (gcc), SteamOS `linux-neptune-72` 7.2.7 (gcc) and CachyOS 7.3.1 (clang, lld).
  Toolchain differences of the build container were bridged for the test only (gcc 14 / clang 20 instead of the kernels'
  gcc 16 / clang 23, BTF debug info off); the device builds with its own matching toolchain.
- No new compiler warnings apart from the two unused variables in `nvidia_dev_put` that 615 has as well.
- Userspace: NVIDIA's 620.70.06 installer contains every file the recipe installs; it only adds three DLSS files
  (`libnvidia-ngx-builtin-dlssd.so`, `ngx-builtins/nvngx_dlssd.dll`, `nvngx_update.exe`) that Arch's recipe does not
  package for 615 either.

## Not checked
Nothing has run on hardware: cable yank, safe detach, standby, shutdown, attach and BAR resize all need a device test.

## How a device gets it: Decky → Setup & updates → NVIDIA driver → "Try beta driver 620" (only on 615)
The same `egpu-driver-trial` as the 610 → 615 switch: Safe Detach, NVIDIA's files downloaded from download.nvidia.com and
checked against the checksums pinned here, patched and built on the device, attached, health-checked (`nvidia-smi` answers
620.70.06 and Game Mode is on the eGPU display). Healthy → kept (`/etc/nv-egpu-buddy/driver-dir` = `nvidia-open-egpu-620`).
Anything else, or a reset or hang during the trial → 615 is put back (at the next boot, before any eGPU bring-up, if needed).
- **Userspace**: no distribution ships 620.70.06 yet, so it is built from Arch's recipe in `userspace/` (Arch's 615.78.08-2
  recipe body is identical to the one vendored here), version and NVIDIA's checksums changed, plus the same three CachyOS
  extras as 615.
- **CachyOS/Arch**: the installed 615 package files are kept in the package cache before anything changes; a revert installs
  them again (offline).
- **SteamOS**: a third build root + image in `/home/.egpu-buddy-620`, next to 615's; a revert links 615's image back and
  deletes the 620 one.
