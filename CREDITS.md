# Credits

Nothing in this repository would work without the people below. Where a fix is vendored, the file names in this repo
say where it came from.

## On-device testing

- **SilverplayerX** (Discord) — on-device testing and development on the ROG Xbox Ally X (RC73XA) with an ASUS XG Mobile
  2025 (GC34, RTX 5070 Ti Laptop GPU): the XG Mobile releases were run on that device, and the support reports from it
  found the desktop Safe Detach, cable-pull, re-attach, power and fan, and Return to Gaming Mode issues
  fixed here. The screenshot of the desktop app uses that device's readings.
- **RetroMann** (Discord) — AMD eGPU tester: on-device testing of the AMD eGPU path on SteamOS 3.9: Legion Go 1 with an
  AOOSTAR AG02 and an AMD RX 6800 XT. That device's support reports found the USB4 performance starvation (fixed in
  0.7.188), the sleep and resume issues, and drove the AMD tuning of the link and power profile.
- **Ivan C.nunes** (Discord) — AMD eGPU tester: on-device testing of the AMD eGPU path on CachyOS: Legion Go 1 with an AMD
  RX 6750 XT in a Thunderbolt 3 enclosure. That device's support report found the session restart loop on a dock that keeps
  disconnecting (0.7.202) and the Game Mode crash on that card being looked at.
- **zergpoop** (Discord) — AMD eGPU tester: on-device testing of the AMD eGPU path on CachyOS: Legion Go 1 with an AMD RX 9070 XT in a
  Minisforum DEG2. That device's support reports found the AMD tuning crashing RX 9000 cards under load (fixed in 0.7.199),
  led to every installer offering to remove all-ways-eGPU and to the AMD crash dump in the report, and found the card's
  256 MB memory window behind the dock (fixed in 0.7.210), and narrowed the remaining game crashes down to the AMD driver.
- **akamel001** (GitHub) — bug reports with measured root causes and suggested fixes, from a ROG Xbox Ally X (RC73XA)
  with an ASUS XG Mobile (RTX 5070 Ti Laptop GPU) on SteamOS 3.9.5 beta:
  - [#3](https://github.com/denver8989/EGPU-Buddy/issues/3): two boot services bringing up the eGPU at once, about 45 s
    added to every eGPU boot (userspace boot 58.5 s → 14.5 s), and the helper aiming at a non-GPU device (fixed in 0.7.198).
  - [#4](https://github.com/denver8989/EGPU-Buddy/issues/4): the desktop app's Update aborting on untested hardware and
    reporting staged updates as failed (fixed in 0.7.201 / 0.7.202).
  - [#5](https://github.com/denver8989/EGPU-Buddy/issues/5): the desktop app showing the installed version and "Up to date"
    (fixed in 0.7.202).
  - [#6](https://github.com/denver8989/EGPU-Buddy/issues/6): the screen watcher's EDID reads making a DisplayPort monitor
    blink after a screen-off (fixed in 0.7.208, every machine in 0.7.209).

## ASUS XG Mobile

- **Kentronix57 — [Decky-Loader-XGMobile-Manager](https://github.com/Kentronix57/Decky-Loader-XGMobile-Manager)** (GPL-3.0),
  **[tanayabhay-creator's fork](https://github.com/tanayabhay-creator/xg-mobile-manager-internal)** (GPL-3.0),
  **stensmir — [xg-mobile-linux](https://github.com/stensmir/xg-mobile-linux)** (MIT) and
  **ItzSkyeYT — [xgm-egpu](https://github.com/ItzSkyeYT/xgm-egpu)** (MIT) — documented how the proprietary-connector
  XG Mobile is switched (`egpu_enable` / `egpu_connected`, the slow firmware write, switching off only after the GPU is
  removed) and that laptop-class XG Mobile GPUs take no driver power limit. Those facts are reimplemented in
  `egpu-detect`; no code was copied from the GPL projects. xgm-egpu's FINDINGS.md also traced, in the driver source,
  why XG Mobile links died ~10 s after init: the RM allows Gen3 only with `NVreg_EnablePCIeGen3=1` and otherwise
  retrains the link down. `egpu-hw-repair` sets that option on a ROG Ally or with an XG Mobile (written here, not copied).

- **seerge — [G-Helper](https://github.com/seerge/g-helper)** (GPL-3.0), with the initial XG Mobile payload discovery by
  **RomanYazvinsky** (credited in G-Helper's `app/USB/XGM.cs`) — the XG Mobile's USB control protocol: 300-byte feature
  reports on report 0x5E, the `^ASUS Tech.Inc.` handshake, fan curve (`D1 01` + 8 temperatures and 8 duties) and auto
  (`D1 02`), lights (`C5`, `BD`, the `B3`/`B4`/`B5` effect messages and their speed bytes), and the 2025 GC34's USB ID
  0x1C29 ([issue #5008](https://github.com/seerge/g-helper/issues/5008)). Reimplemented in `egpu-xgm`; no code copied.
- **[Handheld Daemon](https://github.com/hhd-dev/hhd)** (antheas) — the same protocol driven from Linux userspace
  through hidraw, and the XG Mobile light brightness message (`BA C5 C4 <0-3>`).
- The XG Mobile's clock offsets use NVML's `nvmlDeviceSetClockOffsets` for P0, as LACT does (see LACT below).

## The scan-out corruption fix (Game Mode UI on NVIDIA)

- **matt-schwartz (matte-schwartz on GitHub)** — found the root cause after two years of reports: gamescope's Vulkan-allocated scan-out
  buffers are backed by scattered video memory and nvidia-drm scans them out without a contiguity check
  (NVIDIA bug 5240452). His analysis, instrumentation and the driver-side experiment are in
  [NVIDIA forum thread 295314](https://forums.developer.nvidia.com/t/display-modes-above-2560x1440p-120hz-with-hdr-enabled-cause-flickering-corruption-within-gamescope-session/295314)
  and [open-gpu-kernel-modules PR #1305](https://github.com/NVIDIA/open-gpu-kernel-modules/pull/1305).
- **NightHammer1000** — published the GBM-scanout route for gamescope that this project builds, branch
  [`poc/gamescope-gbm-route`](https://github.com/NightHammer1000/gamescope/tree/poc/gamescope-gbm-route)
  (8 commits on top of gamescope 3.16.25, pinned at `2bfc18c`), and tested it across several NVIDIA cards.
- **antheas** — the compact original of the same idea:
  [antheas/gamescope@fa6f7f2](https://github.com/antheas/gamescope/commit/fa6f7f2503c2e773acf818ad688ddd1db73df3a0).
- **Matthewmachin962** and the other testers in that thread who confirmed the fix at 5120×1440.

## Performance boost (M3): eGPU games on the handheld's screen

- **Themaister (Hans-Kristian Arntzen) — [PyroWave](https://github.com/Themaister/pyrowave)** (MIT), with its
  [Granite](https://github.com/Themaister/Granite) Vulkan backend (MIT). The GPU wavelet codec that packs each frame
  on the eGPU and unpacks it on the handheld's GPU. Built unmodified, pinned at `502a3b5`; `packaging/xpw` only wraps it.
- **relil** — `--prefer-drm` for gamescope
  ([relil/gamescope-eGPU](https://github.com/relil/gamescope-eGPU), upstream PR #2220): choosing the screen's GPU
  separately from the rendering GPU. Vendored unchanged as `packaging/gamescope-gbm/0002-prefer-drm-relil.patch`.

## The hot-unplug-safe driver

- **NickNill** — maintainer of the AUR `nvidia-open-egpu` recipe whose PKGBUILD and base patches (110–140) this
  package builds on.
- **bdandy** — [open-gpu-kernel-modules PR #985](https://github.com/NVIDIA/open-gpu-kernel-modules/pull/985),
  Thunderbolt/eGPU hot-unplug kernel support, vendored as patch 160.
- **roger-pmta** — [open-gpu-kernel-modules PR #984](https://github.com/NVIDIA/open-gpu-kernel-modules/pull/984),
  the `RmForceExternalGpu` registry key, vendored as patch 170.
- Patches 165, 166 and 167 (deferred mode-config cleanup, software-only atomic commits during removal, detaching
  NVKMS kapi events on surprise removal) were written for this project on top of those.

## LACT — the base of the eGPU control side

- **Ilya Zlobintsev — [LACT](https://github.com/ilya-zlobintsev/LACT)** (MIT). This project's GPU control side grew out
  of a private fork of LACT ("LegionLACT") that was extended with eGPU management: the power-limit and clock-offset
  controls, the apply / keep / revert safety for pending GPU settings, the telemetry collection and the eGPU status
  reporting were first built inside that fork, and the first version of the Decky plugin talked to its daemon. The
  code shipped here was since rewritten to call nvidia-smi and NVML directly so that nothing depends on a running
  `lactd`, but the design and parts of the control logic derive from LACT and its NVIDIA backend.
  LACT's license: MIT, Copyright (c) 2023 Ilya Zlobintsev.

## The USB4 link stability (the AMD data-fabric sync flood)

- **damianbienias32** (CachyOS forum, [setup](https://discuss.cachyos.org/t/my-setup-mini-pc-aorus-egpu-and-cachyos/34425)
  and [eGPU control switcher](https://discuss.cachyos.org/t/egpu-control-switcher/34486) threads) — the platform twin
  (Ryzen AI Max+ USB4 host + the same AORUS AI Box on CachyOS) whose method this project's attach path follows: bring
  the card up only after the desktop, disable ASPM/L1 substates on both ends of the tunnel, pin the link speed with
  hardware autonomous speed change disabled and retrain **before** the driver loads, keep the GPU at P0. Before that,
  every boot with the card attached ended in an AMD data-fabric sync-flood reset on this machine.
- **The open-gpu-kernel-modules [#979](https://github.com/NVIDIA/open-gpu-kernel-modules/issues/979) thread** — roger-pmta
  (opener), apnex, jciolek, lokmantsui, efenex and others, who established that the tunneled link's autonomous speed
  negotiation, not GPU clocks, triggers the GSP lockdown that cascades into the flood, and that `pcie_aspm=off` is harmful
  on AMD USB4 hosts.
- **nikomiiller** (NVIDIA forum thread [365386](https://forums.developer.nvidia.com/t/365386), same box and GPU) — the
  link-speed cap, ASPM-off and persistenced workarounds that were tested first.
- **Alex Forencich** — the [setpci link-speed recipe](https://alexforencich.com/wiki/en/pcie/set-speed) (Link Control 2
  target speed, retrain bit) that the pin is written with.
- **DamianKA1993 — [blackwell-egpu-manager](https://github.com/DamianKA1993/blackwell-egpu-manager)** (MIT) — a tool built
  around the same approach (udev-driven attach, setpci ASPM/link control, boltctl authorization, P0 lock) for Blackwell
  eGPUs; not used here, listed because the approach is the same lineage.
- **ewagner12 — [all-ways-egpu](https://github.com/ewagner12/all-ways-egpu)** (MIT) — the `boot_vga` bind-mount
  technique (its "Method 2") is reimplemented in the experimental `egpu-generic` path (non-NVIDIA eGPUs) so that
  compositors pick the eGPU as primary; the NVIDIA path does not use it (its copy never ran and was removed in 0.8.0);
  no code was copied, the idea and the file layout (a `0`/`1` file bind-mounted over the sysfs flag, a list of mounted
  paths for cleanup) are his.
- The PCIe DPC handling (clearing the containment trigger so the second USB4 port forms its tunnel, re-arming it before
  the driver loads), freeing the enclosure's empty Thunderbolt sibling ports so the 16 GB BAR fits, and the flood lockout
  that breaks a reboot loop were worked out on this machine.

## Related projects (no code shared)

- [hertg/egpu-switcher](https://github.com/hertg/egpu-switcher) — X.Org-only eGPU switching; not applicable to
  gamescope/Wayland, nothing taken from it.
- [WowOne987/eGPUBridge](https://github.com/WowOne987/eGPUBridge) — a Decky plugin for eGPU display switching (AMD
  RX 9070 on a Legion Go S, with NVIDIA driver loading). Independent work from the same period; it replaces the whole
  gamescope session script, this project wraps the distro's. Checked side by side: no shared code. Three of the later
  optional add-ons under Extras (testing) follow ideas seen there: the USB4 link row, TV control (Wake-on-LAN / ADB),
  and the support report. Each was written separately for this project.
- [djanice1980/eGPU-Blackwell-Stability](https://github.com/djanice1980/eGPU-Blackwell-Stability) — Blackwell eGPU on a
  Strix Halo host (Flow Z13) with apnex's driver patches; it uses the card for render offload only and does not drive a
  display from it, which is why it never meets the display-path problems solved here.

## Everything else this leans on

- **Valve** — gamescope (BSD-2-Clause), the Steam Linux Runtime, Proton, the `gamescope-session` scripts this
  wraps, and the gamescope WSI layer whose source made the `WAYLAND_DISPLAY` bug findable.
- **jp7677 and the dxvk-nvapi contributors** — NVAPI on Linux, without which DLSS on the eGPU would not exist.
- **Bazzite** — their documentation of Game Mode quirks on NVIDIA.
- **CachyOS** — the Deckify handheld edition this was built on.
- **Decky Loader** and its plugin template. Plugin updates go through Decky Loader's own installer
  (`utilities/install_plugin`, the call its plugin store makes, read from Decky Loader's frontend source), so Steam
  keeps running during an update.
- **Valve's Steam client** — the display-mode messages (`SystemDisplayManager` state and `SetMode`) that pick each
  screen's best resolution and refresh rate were read from the Steam client's own interface code; their field
  numbers are not documented by Valve.
- **Kazuhiko Arase** — [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), which draws the
  support report's QR code.
- **NVIDIA** — nvidia-open, and the engineers who acknowledged the scan-out bug and escalated it.

If your work is used here and is not credited, open an issue and it will be fixed.

## Images in the README

- **bernhard.berger**: the "before" photo of the corrupted Game Mode interface, from
  [NVIDIA developer forum thread 295314](https://forums.developer.nvidia.com/t/display-modes-above-2560x1440p-120hz-with-hdr-enabled-cause-flickering-corruption-within-gamescope-session/295314).
- **Valve**: the "after" Game Mode screenshot, from [steamdeck.com](https://www.steamdeck.com/en/software).

If you own one of these images and want it credited differently or removed, open an issue.
