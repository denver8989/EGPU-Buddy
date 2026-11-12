# NVIDIA Settings > Advanced Tinkering: findings, corrections, plan

Brief: owner's research brief of 2026-11-12. This file records what was checked, what the brief got wrong, what
phase 1 ships, and what still needs an owner decision. GPU live migration, AI video / VSR and OptiScaler are excluded
entirely and were not researched.

## Corrections to the brief (checked against source and upstream on 2026-11-12)

| Brief said | Actually |
|---|---|
| "existing NVIDIA Settings > Advanced Tinkering" | Did not exist. Phase 1 adds it, folded at the bottom of NVIDIA settings (plugin + desktop app). |
| Reflex via `DXVK_NVAPI_VKREFLEX=1` | Only for **Vulkan** games, and only where the dxvk-nvapi Reflex layer is installed. NVIDIA's 615 guide lists it; the current guide no longer does, and dxvk-nvapi 0.9.3 reportedly makes the layer obsolete. DirectX games get Reflex through Proton's DXVK-NVAPI with no switch. Vulkan Reflex needs driver 615+ and DXVK-NVAPI 0.9.3+. |
| Our existing "Low latency mode" overlaps Reflex | It sets frame queueing / DXVK latency pacing (DX9-12), not Reflex. Kept unchanged. |
| dlssg-open = RTX 30 DLSS-G lab candidate | 3 commits, no published release, tested on one 3080 and two 3090 games, replaces Proton's `nvcuda.dll` and patches dxvk-nvapi in memory, needs a 310.x DLSS-G runtime in the game. Not shipped; the report says so on Ampere cards. Cannot be validated on the owner's RTX 5060 Ti (it has native frame generation). |
| (not in brief) | NVIDIA's guide documents more userspace options that fit the lab: DLSS preset overrides, the NGX updater, Smooth Motion. Phase 1 uses them. |
| Smooth Motion: no requirement | Driver 575+ for RTX 50, 580.82+ for RTX 40; not RTX 30 or older. Must not be combined with a game's native DLSS frame generation. Vulkan only, which covers Proton games. |

## Phase 1 (built): read-only report + global userspace lab switches

- `system/usr/local/sbin/egpu-nv-lab` (runs as the user; refuses on an AMD / Intel install)
  - `status`: report via nvidia-smi only (GPU, architecture, driver, PCIe link, what the card supports), plus the switches.
  - switches write `~/.config/egpu-buddy/nvidia-lab.env`; master off deletes it.
- Shim `packaging/nvt-shim/egpu-nvt.c`: one added line, `apply_env(home, "nvidia-lab.env")`, AFTER the normal NVIDIA settings. With no file it does nothing. `setenv(..., 0)` means a normal setting always wins.
- Switches, each OFF, each gated by card / driver:
  - DLSS newest preset: `DXVK_NVAPI_DRS_NGX_DLSS_{SR,RR}_OVERRIDE=on` + `_RENDER_PRESET_SELECTION=render_preset_latest`
  - DLSS newest files: `PROTON_ENABLE_NGX_UPDATER=1`
  - Smooth Motion: `NVPRESENT_ENABLE_SMOOTH_MOTION=1`
  - Vulkan Reflex layer: `DXVK_NVAPI_VKREFLEX=1`
- The DLSS on-screen indicator was left out: it persists in the Wine prefix registry and needs a reset pass when turned off.
- Opening the section runs only nvidia-smi and reads files; nothing privileged.
- Uninstall removes `nvidia-lab.env` and `nvidia-lab.json`.

Validation: switches → env file → stand-in game through the rebuilt shim, tested with a fake HOME. A normal setting
overrides the lab; master off leaves games clean; AMD install refuses. Not yet tested: each switch's effect in a real
game (needs owner / testers; all are labelled "needs testing").

## Later phases: need owner approval before any code

1. **Per-game experiments.** The shim knows `SteamAppId`, so a `nvidia-lab-<appid>.env` read before the global file is
   a small change. UI: pick the running or last game.
2. **Performance Lab.** MangoHud / mangoapp frame logs plus nvidia-smi telemetry; repeated A/B runs, one variable at a
   time. Read-only first.
3. **Display experiments.** Read-only HDR / VRR / bit-depth report per connector, from EDID and DRM properties.
   Overrides only with a countdown and automatic restore.
4. **Driver Lab** (largest, riskiest):
   - Patch-intent manifest per patch family (110-180).
   - Strict `git apply --check` / `--fuzz=0` pass first; Coccinelle rules only for pre-authored transforms.
   - Lifecycle audit that blocks on any new worker or callback (the 620 content-protection worker is the regression
     fixture).
   - Builds an isolated candidate in CI or a container; never installs it.
   - Trial via a bounded extension of `egpu-driver-trial`, with Safe Detach, boot fallback, health check and automatic
     restore.
   - Classes: A validated, B review, C blocked.

## Owner decisions needed
- Release phase 1? It changes the shared shim binary, inert without the file.
- Which later phase next. Driver Lab needs explicit approval of the `egpu-driver-trial` extension, and a test plan on
  the reference machine.
- Whether to test dlssg-open on the Legion Go 1 + RTX 3080 (manual, per game, off-tree).
