# EGPU Buddy motion presentation

Runtime 14:01. Source checked 2026-11-09 against 0.7.242 / ded738fb0cacbad41335def92c5e41c619012ea7.

Screenshot types are named on screen. GitHub is a real read-only webpage capture. Decky/plugin captures render actual source components with emulated controls/CSS and mocked backend data. The picker and plugin confirmation are reconstructions from source labels. None is represented as a live installation.

## 00:00–00:20  Real setup demonstration

**Narration:** Opening footage: actual eGPU connection, external Game Mode, unplug test and return to the handheld. The two waits are visibly accelerated. The opening video plays before the timed narration and can be skipped.

**On screen:** Actual owner footage • 8x / 10x wait sections labeled

**Direction:** Reserved footage only. Keep the actual wait visible or mark an edit. Match-cut the handheld silhouette into the app glyph at 00:20. No recreated footage.

**Source:** VID20261109121330.mp4; source/intro-edit-plan.json; asset generated illustration / project assets

## 00:20–00:30  EGPU Buddy

**Narration:** This is EGPU Buddy. It brings an external graphics card into your Linux handheld’s Game Mode, with the controls right in the Quick Access menu.

**On screen:** USB4 handheld → powered external GPU → monitor or TV

**Direction:** Handheld glyph glides in. Connection draws toward external display. Wordmark settles on the beat.

**Source:** README.md:11–17; plugin handhelds/lenovo-legion-go-2.svg; asset generated illustration / project assets

## 00:30–00:55  The handheld needs USB4

**Narration:** For a USB-connected eGPU, the handheld needs USB4 with PCIe tunneling, or a compatible Thunderbolt port. An ordinary USB-C charging or display port is not enough. Check the handheld, dock and cable. Older proprietary XG Mobile connectors use their own supported path. The tested XG Mobile 2025 uses the USB4 / Thunderbolt route.

**On screen:** USB-C describes the connector. USB4 / PCIe tunneling supplies the eGPU connection.

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** egpu-detect dock classification; TESTED.md XG Mobile 2025; USB4 PCIe requirement; asset None

## 00:55–01:15  What had to be fixed

**Narration:** This took more than adding a menu. The NVIDIA driver needs changes so removal does not keep touching hardware that has gone away. Gamescope needs a different scan-out buffer path to fix NVIDIA picture corruption. The app also coordinates Game Mode, screens and audio, with system integration that survives OS updates.

**On screen:** Patched NVIDIA driver • gamescope scan-out fix • session and audio recovery

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** CREDITS.md hot-unplug driver and Game Mode corruption; packaging patches 160,165–167,170; asset None

## 01:15–01:38  Built on community fixes

**Narration:** The NVIDIA picture work builds on NightHammer1000 and antheas, with the root cause identified by matt-schwartz. The hot-unplug driver work builds on NickNill, bdandy and roger-pmta, plus this project’s removal cleanup patches. Decky supplies the plugin framework. These credits are part of the story, not just the closing card.

**On screen:** Picture: NightHammer1000 / antheas / matt-schwartz
Driver: NickNill / bdandy / roger-pmta

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** CREDITS.md; upstream NVIDIA PRs #985 and #984; asset None

## 01:38–01:55  Three parts working together

**Narration:** There are three parts: a Decky plugin for Game Mode, a desktop app with a tray icon, and the system integration underneath. That last part handles the driver and session setup, so the plugin can control it.

**On screen:** 

**Direction:** Three layers build vertically. Use real Decky icon, EGPU icon and source screenshot. Connection particles pass between layers.

**Source:** README.md Features / Install; desktop-app/; plugin src/index.tsx; asset generated illustration / project assets

## 01:55–02:27  Start with tested setups

**Narration:** Testing includes Legion Go 2 with the AORUS RTX 5060 Ti AI Box, Legion Go 1 with an RTX 3080 and AOOSTAR AG03, and ROG Xbox Ally X with XG Mobile 2025. Legion Go S Z1 Extreme is also in testing, including Ming’s Radeon RX 9070 XT setup. That last setup has an unresolved AMD removal issue. These are reported test combinations, not a blanket compatibility list.

**On screen:** Legion Go S Z1 Extreme added • AMD removal issue remains open

**Direction:** Actual app glyphs reveal left to right. Pair each with its tested dock and card. Hold final row so combinations are readable.

**Source:** README.md Tested hardware; TESTED.md; asset generated illustration / project assets

## 02:27–03:07  eGPU docks tested so far

**Narration:** The dock list includes the AORUS RTX 5060 Ti AI Box, AOOSTAR AG03 and AG02, ASUS XG Mobile 2025, MINISFORUM DEG2, and a TREBLEET Thunderbolt 3 enclosure. There is also another Intel JHL7440-based Thunderbolt 3 enclosure whose brand and model are not documented. These are project test reports, including testing still in progress. The catalog photographs identify the dock families, not every tester’s exact unit or revision.

**On screen:** Manufacturer/catalog photos • exact revisions may differ. Testing includes work in progress.

**Direction:** Reveal the seven dock entries in a four-column gallery. Keep the unidentified enclosure explicitly unpictured.

**Source:** README.md Tested hardware; TESTED.md; ACTIVE_TASK.md Ming 2026-11-07/08; asset-sources.json; asset generated illustration / project assets

## 03:07–03:48  GPUs tested and reported

**Narration:** The NVIDIA list is RTX 3080, RTX 5060 Ti, and the RTX 5070 Ti Laptop GPU inside XG Mobile 2025. An RTX 4070 has also been reported working by a user, with less complete setup detail. AMD testing includes Radeon RX 6800 XT, RX 6750 XT, RX 9070 and RX 9070 XT. AMD remains beta. No specific Intel eGPU model is documented as tested in this source set.

**On screen:** Test reports are not a promise for every dock / OS combination.

**Direction:** Show NVIDIA and AMD lists together; distinguish user-reported RTX 4070 from detailed on-device testing.

**Source:** README.md NVIDIA generation paragraph and hardware table; TESTED.md AMD sections; ACTIVE_TASK.md Ming; asset generated illustration / project assets

## 03:48–04:03  Device glyphs by Victor Borges

**Narration:** The device-specific handheld outlines come from Victor Borges’s handheld-controller-glyphs project. EGPU Buddy uses those real outlines in its screen picker. Thanks, Victor, for making them available under the MIT license.

**On screen:** Victor Borges / @victor-borges
github.com/victor-borges/handheld-controller-glyphs

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** CREDITS.md handheld outlines; vendored LICENSE; github.com/victor-borges/handheld-controller-glyphs; asset None

## 04:03–04:23  SteamOS. CachyOS. Bazzite.

**Narration:** The tested Game Mode systems are SteamOS, the handheld Deckify configuration of CachyOS, and Bazzite’s handheld image, bazzite-deck. NVIDIA is the main supported path. AMD and Intel use a beta path. Check the exact card, dock, device and operating-system combination.

**On screen:** CachyOS: handheld / Deckify
Bazzite: handheld image / bazzite-deck

**Direction:** Official distro marks enter together. Steam logo labeled SteamOS, not a custom SteamOS logo. Beta qualifier stays visible.

**Source:** README.md:15, Tested hardware; TESTED.md AMD / Intel; asset generated illustration / project assets

## 04:23–04:44  Connect, then let Game Mode move

**Narration:** After installation and the required reboot, plugging in the eGPU starts the attach flow. On supported tested setups, Game Mode moves to the external screen and sound follows. The display can go dark briefly during the transition. Show your own measured result here rather than promising an instant switch on every device.

**On screen:** A short dark-screen transition can be part of the attach flow.

**Direction:** Signal travels from handheld through eGPU. External display illuminates. Small transition label acknowledges brief black screen.

**Source:** README.md Features; original §6; current tested-path qualification; asset generated illustration / project assets

## 04:44–05:02  Safe Detach comes before unplugging

**Narration:** For a planned disconnect, close the game, open EGPU Buddy and choose Safe Detach. Confirm, keep the cable connected, and wait for Game Mode to return to the handheld. Reopen the menu and check that it says it is safe to unplug. That is the normal controlled route.

**On screen:** Close game → Safe Detach → wait → read unplug status → unplug

**Direction:** Show real main screenshot beside step sequence. Signal fades toward handheld. Cable remains connected until confirmation. No yank demonstration.

**Source:** src/index.tsx Safe Detach confirmation and gameUp guard; ACTIVE_TASK supplied 2026-11-08 AMD detach issue; asset generated illustration / project assets

## 05:02–05:31  What if the cable gets pulled?

**Narration:** The patched NVIDIA driver also handles surprise removal. It tracks that the GPU is gone and avoids invalid hardware accesses, while the app brings Game Mode back to the handheld. On tested NVIDIA setups, a yank recovers to a usable handheld in a way similar to Safe Detach, and replugging attaches again. A running game may close. This is recovery support, not a universal guarantee across all cards and docks.

**On screen:** Patched NVIDIA removal handling + app/session fallback
Tested recovery reaches the handheld again; a running game may close.

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** TESTED.md surprise removal table; CREDITS patches160/165–167/170; bdandy NVIDIA PR985; asset None

## 05:31–05:55  Choose where Game Mode appears

**Narration:** The screen picker shows connected displays with their names, ports, resolution and refresh rate. The shapes distinguish a handheld, a TV and an ultrawide. Choose a screen to move Game Mode there. The default best-picture setting asks for native resolution and the highest refresh rate. Compatible screens can also wake and switch input automatically.

**On screen:** 

**Direction:** Main-page screenshot held large, with a traveling highlight. Device glyph fans into handheld and display choices.

**Source:** README.md Multiple displays / Best picture; src/index.tsx screenIcon / applyBestScreenModes; asset generated illustration / project assets

## 05:55–06:10  The eGPU can render for a small screen

**Narration:** You can keep the handheld screen while games render on the eGPU. XR glasses connected to the handheld can use the passthrough path too. Compatibility is still being tested, so check the current notes for your glasses and setup.

**On screen:** 

**Direction:** Reverse signal route from eGPU to handheld display. XR connection shown as a labeled output, not a universal support badge.

**Source:** src/index.tsx XR connected dialog; supplied ACTIVE_TASK pending AR retest; asset generated illustration / project assets

## 06:10–06:31  Readings and GPU controls

**Narration:** Details shows the GPU, driver, connection and live readings: temperature, power, clocks, memory and load. Available controls include a power limit and clock offset. What you can change depends on the card and install path. Use the real readings in your recording, not the animated example values.

**On screen:** 

**Direction:** Real Details screenshot moves upward slowly. Telemetry labels animate beside it; no invented FPS or benchmark numbers.

**Source:** README.md GPU details; plugin Details; original §8; asset generated illustration / project assets

## 06:31–06:49  XG Mobile gets its own controls

**Narration:** On the supported ASUS XG Mobile setup, the plugin and desktop app expose the power target, fan modes, a custom fan curve, dock lighting, and core and memory offsets. These are specific dock controls, shown here with the project’s real interface.

**On screen:** 

**Direction:** Official ASUS product photo paired with real XG screenshot. Gentle push in, then fan/light/power labels appear.

**Source:** README.md ASUS XG Mobile; screenshot-xg-mobile.png; ASUS gallery; asset generated illustration / project assets

## 06:49–07:08  The same setup on the desktop

**Narration:** Desktop Mode has an EGPU Buddy app and tray icon, with GPU readings, screen selection, power controls, Safe Detach and Re-attach. This screenshot uses an ASUS XG Mobile: the lighting and fan controls shown here are specific to that dock.

**On screen:** Desktop app / tray access
Lighting and fan controls shown: ASUS XG Mobile only

**Direction:** Actual desktop screenshot fills right side. App icon moves down toward an illustrated tray position, labeled schematic.

**Source:** README.md Desktop app / Multiple displays; desktop screenshot; asset generated illustration / project assets

## 07:08–07:30  Optional settings (experimental)

**Narration:** NVIDIA settings adds low latency, V-sync and frame limits. AMD’s Adrenaline Settings adds supported Linux equivalents, with experimental FSR upgrades and Fluid Motion Frames for compatible games. Other opt-in extras include USB4 link checks and LG TV control. The Big Art mode menu fix is for NVIDIA only.

**On screen:** 

**Direction:** Three labeled text lanes appear. Experimental label stays on screen. Avoid Windows vendor control-panel screenshots.

**Source:** RELEASE-NOTES.md 0.7.236; README.md NV GPU Buddy; src/index.tsx; asset generated illustration / project assets

## 07:30–07:53  Save a report for Discord support

**Narration:** For help on Discord, open EGPU Buddy and choose Show details. Under Support report, select Save support report to Desktop. Wait for it to finish. Then switch to Desktop Mode and open your Desktop folder. In the Discord support channel, attach the saved report file with a short description of the problem and what you were doing when it happened.

**On screen:** Show details → Support report → Save to Desktop → attach the file in Discord

**Direction:** Highlight the source-rendered Save support report to Desktop button; show the saved file moving from Desktop to a Discord attachment step. Demo file only.

**Source:** capture-sandbox/plugin-source.tsx Support report section, makeReport; user requested Discord support workflow; asset generated illustration / project assets

## 07:53–08:17  Built with testers and upstream projects

**Narration:** Thanks to the hardware testers, including SilverplayerX, 1khanfusion, RetroMann, Ivan C.nunes, zergpoop, akamel001 and Ming. Thanks also to Victor Borges for the handheld glyphs, and the projects and patch authors credited earlier. The full list is in CREDITS.md. Next, let’s install the plugin.

**On screen:** Hardware testers + patch authors + Victor Borges / handheld-controller-glyphs

**Direction:** Tester names hold in two columns. Short upstream line, then chapter wipe into how-to. Full attribution in source files.

**Source:** CREDITS.md; original §12; asset generated illustration / project assets

## 08:17–08:28  Install the Decky plugin

**Narration:** With Decky Loader already installed, we will add the EGPU Buddy plugin from Game Mode, then install its system integration. Those are two separate steps.

**On screen:** Decky Loader already installed → EGPU Buddy plugin → system integration.

**Direction:** Chapter card with Decky icon and app icon. Two-stage graphic separates plugin from system integration.

**Source:** README.md Install; Decky official README; asset generated illustration / project assets

## 08:28–08:41  Before you start

**Narration:** This tutorial assumes Decky Loader is already installed. Start in Game Mode, with internet and power available. Keep the eGPU unplugged during installation and the reboot afterwards.

**On screen:** Decky Loader already installed.
Keep eGPU unplugged through installation AND reboot.

**Direction:** Unplugged cable graphic. Official Decky-on-device image held beside prerequisite. On-screen installer URL decky.xyz.

**Source:** README.md Install; https://github.com/SteamDeckHomebrew/decky-loader#installation; asset decky-general.png

## 08:41–08:59  1. Enable Decky Developer mode

**Narration:** In Game Mode, open the Quick Access menu and select Decky. Open Decky’s settings, choose General, and turn on Developer mode. The Developer tab becomes available. This is Decky’s setting, not Steam’s separate developer menu.

**On screen:** Quick Access → Decky → Settings → General
Developer mode: ON

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual upstream GeneralSettings component, source-rendered sandbox; asset decky-general.png

## 08:59–09:21  2. Download the Decky ZIP

**Narration:** The file route avoids typing a long URL. Open the project’s Releases page in a browser. Desktop Mode is the simplest place to do that. Download the EGPU-Buddy-Decky ZIP asset for the current release. Do not choose the dot run desktop installer or GitHub’s source-code ZIP.

**On screen:** Browser download → EGPU-Buddy-Decky-<version>.zip
Desktop Mode is simplest; return to Game Mode afterward.

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual GitHub release page read-only capture; verified release v0.7.242; asset github-release-actual.png

## 09:21–09:41  3. Browse to the downloaded ZIP

**Narration:** Return to Game Mode. In Decky settings, open Developer. Under Install Plugin from ZIP File, choose Browse. In the file picker, open your Downloads folder and select the EGPU Buddy Decky ZIP. The file route and URL route install the same plugin.

**On screen:** Developer → Install Plugin from ZIP File → Browse
Downloads → EGPU-Buddy-Decky-0.7.242.zip

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual upstream DeveloperSettings source; installFromZip opens ZIP-only picker; asset decky-developer.png

## 09:41–09:59  4. Read Decky’s warning

**Narration:** Decky shows a third-party plugin warning after Browse and before its file picker opens. Read it and check that the download came from the official project. Continue after any countdown, then select the ZIP. The URL route shows the same warning before starting its install flow.

**On screen:** Browse → third-party warning → Continue → file picker

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual upstream WarnThirdParty source-rendered sandbox; seconds=0 in capture; asset decky-warning.png

## 09:59–10:14  The download is in Downloads

**Narration:** Select the Decky ZIP you downloaded, then confirm the selection. On a device with a different account name or browser download directory, use that location. Keep the ZIP intact; Decky reads it directly.

**On screen:** Select the ZIP file. Do not extract it.

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Reconstructed picker screenshot; path/ZIP filtering verified in Decky DeveloperSettings source; asset file-picker.png

## 10:14–10:30  Confirm EGPU Buddy, then open it

**Narration:** Check the plugin name and version in the installation confirmation, and install it. Once Decky finishes, return to its plugin list and open EGPU Buddy. You have installed the plugin; the system integration comes next.

**On screen:** Confirm plugin name and version → Install → open EGPU Buddy

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Reconstructed confirmation screenshot, exact PluginInstallModal locale wording; asset plugin-confirmation.png

## 10:30–10:46  Alternative: paste the direct ZIP URL

**Narration:** If you already have the direct release-asset link, paste it into Install Plugin from URL and choose Install. Use the ZIP download link, rather than the release-page address. This is an alternative to browsing for the downloaded file.

**On screen:** Alternative path only: direct ZIP asset URL → Install

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual upstream DeveloperSettings source-rendered sandbox; asset decky-developer.png

## 10:46–11:06  5. Choose the external GPU vendor

**Narration:** Press Install system integration. The next prompt asks Which GPU type will you use? Choose NVIDIA for an NVIDIA eGPU, or AMD / Intel beta for those external cards. Choose the eGPU’s vendor, even when your handheld’s built-in graphics uses another vendor.

**On screen:** Install system integration → external GPU vendor

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Current actual plugin installClick rendered in sandbox; asset install-choice.png

## 11:06–11:25  NVIDIA branch: build the patched driver

**Narration:** For NVIDIA, the next confirmation is titled Install for an NVIDIA eGPU. Review the components and expected time, then continue. It installs the patched driver, the NVIDIA picture fix and the rest of the integration. Keep the charger connected and the eGPU unplugged.

**On screen:** NVIDIA → Install for an NVIDIA eGPU → Continue

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Current confirmInstallNow with mocked NVIDIA install choice; asset install-confirm-nv.png

## 11:25–11:54  AMD / Intel branch: no NVIDIA build

**Narration:** For AMD or Intel, select AMD / Intel beta. The confirmation is titled Install for an AMD / Intel eGPU. The installer skips the patched NVIDIA driver and NVIDIA-only gamescope build, and installs the vendor-neutral attach, detach, fallback and audio integration. The shared confirmation still mentions NVIDIA components, but the AMD / Intel installer skips them. This path remains beta.

**On screen:** AMD / Intel (beta) → confirm → vendor-neutral integration
Skips NVIDIA driver and NVIDIA-only gamescope build.

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual prompt; install.sh GPU_VENDOR=amd gating; shared WHAT wording includes NVIDIA items even here; asset install-confirm-amd.png

## 11:54–12:17  Conditional prompts: stop and read

**Narration:** Your setup can add prompts. Unknown hardware can require I accept the risk. Conflicting eGPU tools can offer removal or cancellation. If Bazzite carries a built-in NVIDIA driver, use the appropriate non-NVIDIA handheld image before installing. Do not treat Continue anyway as a recommendation to ignore an incompatible image.

**On screen:** Conditional: untested hardware, conflicting tools, or NVIDIA image

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual withConflictCheck / confirmInstallNow; Bazzite preflight; asset install-untested.png

## 12:17–12:37  Conflicts need attention first

**Narration:** If a conflict prompt appears, read its identified tool or image and the evidence. Use the supported removal or image-change route. The screenshot shows the actual source-driven warning with a simulated Bazzite image conflict. Cancel rather than blindly continuing past an incompatible image.

**On screen:** Conflicts: read evidence and resolve before continuing.

**Direction:** Show the current reference visual, with an animated focus and timed caption.

**Source:** withConflictCheck; simulated Bazzite NVIDIA image state; asset install-conflict.png

## 12:37–12:55  6. Wait for integration to finish

**Narration:** The NVIDIA path can take several minutes while the driver builds. The AMD / Intel path skips that build. Read the actual progress and result rather than using the animation’s elapsed time. You can close the menu while work continues, and the plugin reports completion.

**On screen:** NVIDIA: patched driver build
AMD / Intel: no NVIDIA build

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual Progress component with mocked progress; no installation executed; asset install-progress-nv.png

## 12:55–13:09  The AMD / Intel progress path

**Narration:** Here is the same progress interface on the AMD / Intel branch. The capture uses a mocked installation step, so it demonstrates the layout rather than a successful hardware test. Follow the result on your own device.

**On screen:** AMD / Intel example • simulated progress, not a device test

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Current actual plugin with mocked AMD setup state; asset install-progress-amd.png

## 13:09–13:24  If installation fails, repair first

**Narration:** An installation error is not the success screen. Keep the eGPU unplugged, read the message and log location, and use the displayed Repair route. Resume the reboot and first-connect steps only after the integration reports success.

**On screen:** Error → keep eGPU unplugged → Repair / inspect log

**Direction:** Show the current reference visual, with an animated focus and timed caption.

**Source:** Current su.rc error path rendered with mocked rc20; asset install-error.png

## 13:24–13:44  7. Reboot before connecting the eGPU

**Narration:** When installation reports success, choose Reboot the system. Keep the eGPU unplugged throughout that reboot. The required kernel protections are not active until then. If an error appears, leave the eGPU unplugged and follow Repair or the displayed message before proceeding.

**On screen:** Success → Reboot the system
eGPU stays unplugged through reboot.

**Direction:** Animate the illustrated signal path or show the referenced capture with progressive focus.

**Source:** Actual su.rc=0 / needs_reboot UI; mocked success state; asset install-success.png

## 13:44–14:01  Connect after the reboot

**Narration:** Once Game Mode is back, connect the eGPU and check its status in EGPU Buddy. Your setup is ready for its first test. You’ll find the downloads, tested hardware list and full instructions on GitHub, with the Discord link below. See you on the big screen.

**On screen:** After reboot: connect, inspect status, then test your setup.

**Direction:** Reconnect topology, then GitHub and Discord end card. User footage can reprise behind final labels.

**Source:** README.md Install / Reporting problems; Original §13; asset generated illustration / project assets
