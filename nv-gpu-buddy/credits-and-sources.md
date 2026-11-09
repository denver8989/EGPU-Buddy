# Credits and source notes

2026-11-09. App/source baseline: 0.7.242, commit ded738fb0cacbad41335def92c5e41c619012ea7.

## Device glyphs

**Victor Borges (@victor-borges)** — [handheld-controller-glyphs](https://github.com/victor-borges/handheld-controller-glyphs), MIT. The app’s actual silhouettes are used with contrast recolouring. Legion Go outlines have the upstream provenance described in the retained vendored notice. The main presentation includes a visible spoken and on-screen credit.

## What had to be patched

- NVIDIA Game Mode picture: NightHammer1000 GBM-scanout gamescope route, antheas original compact fix, root-cause analysis by matt-schwartz. [Project credits](https://github.com/denver8989/EGPU-Buddy/blob/master/CREDITS.md).
- NVIDIA hot unplug: NickNill nvidia-open-egpu base recipe, [bdandy PR #985](https://github.com/NVIDIA/open-gpu-kernel-modules/pull/985), [roger-pmta PR #984](https://github.com/NVIDIA/open-gpu-kernel-modules/pull/984), plus project patches 165–167 for removal cleanup. The PR description is not a universal hardware guarantee.
- GPU controls derive from Ilya Zlobintsev’s LACT design/work; XG Mobile protocol work credits G-Helper, RomanYazvinsky and Handheld Daemon. Decky supplies the plugin framework. Full authors and licenses: original project CREDITS.md and source notices.

## Capture provenance and limits

- `github-release-actual.png`: real official release page, read-only browser capture.
- `decky-general`, `decky-developer`, `decky-warning`: actual upstream React component logic and labels rendered in a sandbox. The Decky skin/control runtime is emulated. Unrelated General subcomponents are stubbed out, leaving those headings empty. These are not live handheld screenshots.
- `install-*`: actual snapshot of current EGPU Buddy frontend; build-time plugin version normalized to 0.7.242 as release packaging does. Hardware, progress, install results and eligibility are mocked. No backend install action executes.
- File picker and plugin-install confirmation: reconstructed from upstream source and locale labels, clearly identified on screen.
- Existing repository screenshots can show older app versions and are labeled reference images.
- No Steam Deck device depiction is used in the active presentation. The Steam software logo identifies SteamOS only.

## Source wording issues preserved, not hidden

The current frontend uses one shared WHAT summary. On the AMD / Intel branch it still mentions NVIDIA components, while install.sh skips those builds. On initial NV GPU Buddy enrollment, the track is not recorded yet, so its final shared summary mentions eGPU pieces while the dedicated installer excludes them. The presentation shows the real text and explains the dedicated installer behavior. These are observed UI wording problems, not changes made by this media task.

## Hardware evidence

The current project memory ACTIVE_TASK.md (2026-11-08 Ming CZX85K) identifies Legion Go S Z1 Extreme, SteamOS 3.10 and the RX 9070 XT / Trebleet case with removal crashes. The dock-top change in 0.7.237 was not yet confirmed on that setup. It is included as testing with an open issue, not declared fully working. TESTED.md documents surprise recovery on tested NVIDIA configurations. Ordinary USB-C does not imply a PCIe eGPU connection. XG Mobile 2025 is the tested USB4/Thunderbolt route; legacy proprietary XG Mobile is separate.

## Asset manifest

- **assets/bazzite.svg** — Bazzite official branding; trademark retained Source: https://bazzite.gg/content/uploads/2024/02/Bazzite_Color_Long.svg
- **assets/cachyos.svg** — CachyOS official branding; trademark retained Source: https://cachyos.org/_astro/logo.DuMERIP6.svg
- **assets/decky.png** — Decky Loader official icon, upstream BSD-3-Clause; trademark retained Source: https://decky.xyz/icons/icon-512x512.png
- **assets/steam.png** — Valve official Steam logo; trademark retained Source: https://cdn.fastly.steamstatic.com/steamdeck/images/steamdeck_steamlogo.png
- **assets/install-choice.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-offer.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-confirm.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-final.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-main.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-settings.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/icon.png** — Actual NV GPU Buddy app icon, EGPU Buddy project Source: /home/deck/SteamOS-EGPU-Buddy/desktop-app/nv-gpu-buddy.png
- **assets/decky-developer.png** — Decky Loader, BSD-3-Clause. Actual source components captured in a sandbox; CSS/control runtime emulated; no live installation. Source: https://github.com/SteamDeckHomebrew/decky-loader/tree/main/frontend/src/components/settings/pages

Original illustrations and atmospheric blue/black background are authored in motion.js. Their geometry is editable. They identify generic hardware rather than pretending to be manufacturer product photos. Original imagery and marks retain their respective rights; final publication permissions/brand terms should be checked. The narrated HTML presentation is published beneath EGPU Buddy on the same GitHub Pages site.

## Narrated presentation revision 02

Narration is generated locally from the owner’s recorded voice, using the existing Qwen3-TTS environment. Only the finished speech MP3s are included in the site; the private recording, model and voice-reference data remain local.

Music: Bensound — SciFi, the same owner-supplied track used in the EGPU presentation. It uses the existing continuous music master with 12-second equal-power crossfades if playback reaches a loop transition, a final four-second fade, and an 11 dB reduction beneath narration.

Source content remains the previously checked 0.7.242 snapshot. Mocked installation/UI captures remain labeled; desktop/laptop hardware testing is still needed.

## New desktop app screenshots — 9 Nov 2026

The owner supplied the images in Desktop/New look. Active desktop-app visuals now use those files unchanged: Overview, NVIDIA/GPU settings, and Extras and setup. The EGPU film also includes the supplied XG Mobile overview and setup previews. Preview images retain visible labels and their example readings are not treated as hardware test evidence. Decky installation dialogs remain source-rendered examples of that separate interface. Per-file original paths and SHA-256 checksums are in asset-sources.json.

Screenshot context correction: Game Mode feature views use Decky plugin imagery again. New desktop images appear only in the EGPU desktop chapter or explicitly labeled Desktop Mode portions of the NV interface/settings chapters. The update-channel explanation retains its original diagram/text.
