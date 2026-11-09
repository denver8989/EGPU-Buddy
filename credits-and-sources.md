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

- **assets/screenshot-main.png** — EGPU Buddy repository, MIT; screenshot-desktop uses SilverplayerX device readings. Source: /home/deck/SteamOS-EGPU-Buddy/docs/assets/screenshot-main.png
- **assets/screenshot-details.png** — EGPU Buddy repository, MIT; screenshot-desktop uses SilverplayerX device readings. Source: /home/deck/SteamOS-EGPU-Buddy/docs/assets/screenshot-details.png
- **assets/screenshot-setup.png** — EGPU Buddy repository, MIT; screenshot-desktop uses SilverplayerX device readings. Source: /home/deck/SteamOS-EGPU-Buddy/docs/assets/screenshot-setup.png
- **assets/screenshot-xg-mobile.png** — EGPU Buddy repository, MIT; screenshot-desktop uses SilverplayerX device readings. Source: /home/deck/SteamOS-EGPU-Buddy/docs/assets/screenshot-xg-mobile.png
- **assets/screenshot-desktop-xg-mobile.png** — EGPU Buddy repository, MIT; screenshot-desktop uses SilverplayerX device readings. Source: /home/deck/SteamOS-EGPU-Buddy/docs/assets/screenshot-desktop-xg-mobile.png
- **assets/icon.png** — EGPU Buddy repository, MIT; screenshot-desktop uses SilverplayerX device readings. Source: /home/deck/SteamOS-EGPU-Buddy/docs/assets/icon.png
- **assets/lenovo-legion-go-2.svg** — victor-borges/handheld-controller-glyphs, MIT; retain upstream notice in source/glyphs-LICENSE Source: /home/deck/SteamOS-EGPU-Buddy/decky-plugin/egpu-buddy/handhelds/lenovo-legion-go-2.svg
- **assets/lenovo-legion-go.svg** — victor-borges/handheld-controller-glyphs, MIT; retain upstream notice in source/glyphs-LICENSE Source: /home/deck/SteamOS-EGPU-Buddy/decky-plugin/egpu-buddy/handhelds/lenovo-legion-go.svg
- **assets/asus-rog-xbox-ally.svg** — victor-borges/handheld-controller-glyphs, MIT; retain upstream notice in source/glyphs-LICENSE Source: /home/deck/SteamOS-EGPU-Buddy/decky-plugin/egpu-buddy/handhelds/asus-rog-xbox-ally.svg
- **assets/display.svg** — EGPU Buddy MIT Source: /home/deck/SteamOS-EGPU-Buddy/decky-plugin/egpu-buddy/src/index.tsx
- **assets/handheld.svg** — EGPU Buddy MIT Source: /home/deck/SteamOS-EGPU-Buddy/decky-plugin/egpu-buddy/src/index.tsx
- **assets/bazzite.svg** — Bazzite official branding; trademark retained Source: https://bazzite.gg/content/uploads/2024/02/Bazzite_Color_Long.svg
- **assets/cachyos.svg** — CachyOS official branding; trademark retained Source: https://cachyos.org/_astro/logo.DuMERIP6.svg
- **assets/decky.png** — Decky Loader official icon, upstream BSD-3-Clause; trademark retained Source: https://decky.xyz/icons/icon-512x512.png
- **assets/steam.png** — Valve official Steam logo; trademark retained Source: https://cdn.fastly.steamstatic.com/steamdeck/images/steamdeck_steamlogo.png
- **assets/xg-mobile.jpg** — ASUS official product image; editorial reference, rights not independently cleared Source: https://dlcdnwebimgs.asus.com/gain/F26E974A-523A-4B3B-8954-CD0BAD788558
- **assets/rog-xbox-ally.jpg** — ASUS official product image; editorial reference, rights not independently cleared Source: https://dlcdnwebimgs.asus.com/gain/BEEE4F75-C6D0-4696-B487-81ACCDAE571B
- **assets/lenovo-legion-go-s.svg** — Victor Borges, MIT; actual app asset, contrast recoloured. See source/glyphs-vendored-LICENSE. Source: https://github.com/victor-borges/handheld-controller-glyphs
- **assets/decky-general.png** — Decky Loader, BSD-3-Clause. Actual source components captured in a sandbox; CSS/control runtime emulated; no live installation. Source: https://github.com/SteamDeckHomebrew/decky-loader/tree/main/frontend/src/components/settings/pages
- **assets/decky-developer.png** — Decky Loader, BSD-3-Clause. Actual source components captured in a sandbox; CSS/control runtime emulated; no live installation. Source: https://github.com/SteamDeckHomebrew/decky-loader/tree/main/frontend/src/components/settings/pages
- **assets/decky-warning.png** — Decky Loader, BSD-3-Clause. Actual source components captured in a sandbox; CSS/control runtime emulated; no live installation. Source: https://github.com/SteamDeckHomebrew/decky-loader/tree/main/frontend/src/components/settings/pages
- **assets/install-choice.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-confirm-nv.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-confirm-amd.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-untested.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-conflict.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-progress-nv.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-progress-amd.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-success.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-error.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-offer.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-confirm.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-final.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-main.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/install-nvb-settings.png** — Source-rendered simulation from actual Decky / EGPU Buddy frontend; emulated styles and mocked backend. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/github-release-actual.png** — Actual GitHub release webpage screenshot, read-only capture 2026-11-09; no downloads started. Source: https://github.com/denver8989/EGPU-Buddy/releases/tag/v0.7.242
- **assets/file-picker.png** — Reconstructed UI screenshot from Decky source labels and known ZIP picker behavior. Not a live screenshot. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox
- **assets/plugin-confirmation.png** — Reconstructed UI screenshot from Decky source labels and known ZIP picker behavior. Not a live screenshot. Source: Capture sandbox in EGPU-Buddy-Motion-Draft/capture-sandbox

Original illustrations and atmospheric blue/black background are authored in motion.js. Their geometry is editable. They identify generic hardware rather than pretending to be manufacturer product photos. Original imagery and marks retain their respective rights; final publication permissions/brand terms should be checked. No video has been published.

## Revision 04: dock gallery and GPU list

The dock and GPU identities come from the local project README/TESTED.md and the Ming test notes in ACTIVE_TASK.md. The manufacturer product pages supply photos only; their marketing and compatibility claims are not treated as proof of EGPU Buddy support. The photo grouping illustrates the model families, not the tester's exact product revision.

- AORUS RTX 5060 Ti AI BOX: [GIGABYTE press image via PR Newswire](https://www.prnewswire.com/mx/comunicados-de-prensa/gigabyte-lanza-la-egpu-aorus-rtx-5060-ti-ai-box-para-llevar-la-potencia-de-una-computadora-de-escritorio-a-las-portatiles-ultrabook-302560402.html).
- AOOSTAR AG03: [manufacturer page](https://aoostar.com/products/aoostar-ag03-egpu-dock).
- AOOSTAR AG02: [manufacturer page](https://aoostar.com/collections/egpu-dock-11-12/products/aoostar-ag01-egpu-dock-with-oculink-port-built-in-huntkey-400w-power-supply-supports-tgx-interface-hot-swap). Current product variants/compatibility notices may differ from the reported test unit. This is a historical test list, not a shopping recommendation.
- ASUS XG Mobile 2025: existing official ASUS gallery asset.
- MINISFORUM DEG2: [manufacturer catalog](https://www.minisforum.com/products/deg2).
- TREBLEET TB3: [manufacturer catalog image](https://www.trebleet.com/product-page/compact-thunderbolt3-egpu-enclosure-with-600w-psu), representative only: exact tester SKU was not documented.
- Ivan C.nunes's Intel JHL7440-based enclosure is listed without a photo because that controller ID does not identify a product model. No stock image is passed off as its exact enclosure.

RTX 4070 is explicitly a user report. No specific tested Intel GPU model is named in this source set. AOOSTAR EG02 appears in upstream comparison/research; it is not included as a direct project tester's dock. This gallery adds no new supported-behavior claims or purchase recommendations. Individual direct image URLs and checksums are in asset-sources.json.

### Transparent dock images

The six dock gallery photographs were edited with the built-in image_gen background-extraction tool. Originals are preserved. Generated sibling assets end in `-cutout.png`; exact prompts, original inputs, saved paths and alpha checks are in `source/cutout-edit-prompts.json`. These are edited catalog images, not photographs of the actual tested units.

AORUS image replacement: user-provided `Aorus 5060ti ai box.png`, copied unchanged to `assets/dock-aorus-user.png`. Its existing alpha transparency is preserved. This supersedes the generated AORUS cutout in the active gallery.

Revision 06: Discord support walkthrough uses the source-rendered Support report section from the existing plugin snapshot, with mocked hardware state. The Save support report to Desktop button is actual source wording. The file-to-Discord diagram is instructional; no report was created or uploaded, and Discord was not accessed. Background music is an original instrumental composition generated by make_music_samples.py; the owner selected Warm downtempo from three mixed previews.

## Supplied opening video and release soundtrack

The owner supplied `VID20261109121330.mp4`; the original is unchanged. `source/intro-edit-plan.json` records the two accelerated waits (8× and 10×), both visibly labeled. Original phone speech remains at normal speed, with high-pass filtering, a light gate, gain and peak limiting.

Music: Bensound — SciFi, owner-supplied `bensound-scifi.mp3`, copied unchanged into `intro-assets/`. This supersedes the earlier original music samples throughout the active presentation. `source/music-loop-plan.json` records the repeated middle section, 12-second overlapping transitions and final fade. A continuous master supplies matching music positions in the intro and presentation; opening speech sidechains the music lower.

Parachuting CPU: generated with the built-in image_gen tool as a new transparent illustration, then animated by FFmpeg after the spoken “skydiving test.” Asset: `intro-assets/cpu-parachute.png`. Exact generation prompt, mode and provenance: `intro-assets/cpu-parachute-provenance.json`.

Opening audio cleanup: chair/background noise suppressed with the FFmpeg arnndn filter and the cb speech model (https://github.com/richardpl/arnndn-models). The recorded speech windows are preserved, with 200 ms crossfades into the cleaned ambience. Original recordings are unchanged. Quick review and the background music toggle were removed from both players at the owner’s request; background music remains mixed under speech.

## New desktop app screenshots — 9 Nov 2026

The owner supplied the images in Desktop/New look. Active desktop-app visuals now use those files unchanged: Overview, NVIDIA/GPU settings, and Extras and setup. The EGPU film also includes the supplied XG Mobile overview and setup previews. Preview images retain visible labels and their example readings are not treated as hardware test evidence. Decky installation dialogs remain source-rendered examples of that separate interface. Per-file original paths and SHA-256 checksums are in asset-sources.json.

Screenshot context correction: Game Mode feature views use Decky plugin imagery again. New desktop images appear only in the EGPU desktop chapter or explicitly labeled Desktop Mode portions of the NV interface/settings chapters. The update-channel explanation retains its original diagram/text.
