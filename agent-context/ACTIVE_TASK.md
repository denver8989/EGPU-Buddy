# Shared task ledger

Checkpoint: 2026-11-10, Asia/Tokyo. Source: checked-out code, Claude transcript, read-only tmux capture, and durable local Claude memory. Owner `unclaimed` means no agent is currently editing that task. Waiting tasks are retained, not silently abandoned. Product changes require their own claim and scope review.

## EGPU-001 — Release AMD/Titan Ridge CEC fix | done | Claude session 43bbea5e

- Owner approved ("yes" / "release it", 2026-11-10). Released 0.7.251: commit 6912dbb on origin/master (verified), release workflow run 42738108610 succeeded, tag v0.7.251 with 5 assets.
- Validation: bash -n + stand-in sysfs test (cec bus layout). Not hardware-tested; see EGPU-002.

## EGPU-002 — Ming Safe Detach hardware confirmation | done (tester confirmed fixed, report 2PWZYH on 0.7.252) | unclaimed

- Legion Go S, RX 9070 XT, Trebleet Titan Ridge. Latest report BS5BEC on 0.7.250 still crashed. Trace from 22HUT6 reaches DP-CEC teardown and AUX NULL dereference; prior fixes never discovered the adapter. The causal fix remains a hardware-unconfirmed hypothesis, not a proven resolution.
- 0.7.251 released; owner given the Discord message for Ming.
- Tester evidence (2026-11-10, via owner): with cec-mote UNINSTALLED the crash still happened; detach worked once the CEC-capable DP->HDMI adapter was unplugged. Confirms DP-CEC adapter as the trigger, independent of cec-mote (SteamOS's own CEC service / cec-wake may configure it). Open risk: if a CEC service reconfigures the adapter between our clear and the unbind, the crash could remain; the 'released (rc N)' line will show.
- Next: on Ming's report, check egpu-generic.log for "CEC cecN on ..." / "CEC cecN released (rc N)" / "no CEC adapter registered" lines, then the kmsg trace.
- (old) Next after release: provide a short message asking Ming to update, try Safe Detach once, and send a report either way. Do not send messages externally without an explicit instruction. Inspect all report sections, especially CEC discovery/release lines, `egpu-generic.log`, and detach kernel trace.
- Success requires actual report evidence; publication alone does not close this task.
- Files owned: none.

## EGPU-011 — AMD: "Show Game Mode on handheld" ignored; Desktop eGPU drop | waiting-tester (handheld fix released 0.7.252) | unclaimed | AMD / Intel install

- Report YPJKMT (Ming, 0.7.250, card's own HDMI, no DP-HDMI adapter): Safe Detach WORKED twice (no CEC adapter = no crash; supports EGPU-002 cause). Dock re-links ~20 s after detach and Game Mode auto-returns to the TV (not yet addressed).
- Handheld button: AMD session branch ignored game-screen=eDP-1 (OUTPUT_CONNECTOR=HDMI-A-1 first). Fixed (unreleased, commit after a3feb2d series): handheld route for AMD (gamescope on iGPU via shim NV_EGPU_GAMESCOPE_HANDHELD_GPU, shim unsets MESA_VK_DEVICE_SELECT/DRI_PRIME on AMD install, games pinned to eGPU), egpu-generic stale-move check skips when pick = panel. Shim stand-in tested; session not run on hardware.
- Desktop attach: eGPU fell off the bus (pciehp Link Down, amdgpu device lost) ~17 s after Game Mode->Desktop at 20:07:50, BEFORE Attach was pressed; cause not in the report. Next: targeted logging if owner wants.

## EGPU-012 — Issue #8 Steam menu fix glXDestroyGLXPixmap | done (released) | Claude 43bbea5e | Steam menu fix on (NVIDIA)

- bbauti's patch applied as-is; rebuilt libegpu-steam-ui.so (same toolchain, GLIBC_2.34 like before). Stand-in: preloaded fake steamwebhelper resolves glXDestroyGLXPixmap to our lib (old build: libGLX). Released 0.7.252 (81dd666, run 42742103047), together with EGPU-011 handheld fix (owner OK). Not tested on real hardware; issue not replied to (owner's call).

## EGPU-013 — Desktop app TV->monitor switch left monitor black | waiting-owner-test (released 0.7.253) | unclaimed | NVIDIA reference path

- 2026-11-10 11:48 JST owner machine: desktop app set-screen DP-7 -> egpu-screen only DP-7 = one kscreen-doctor change (DP-7 on 5120x1440@144 HDR + HDMI-A-1 off) -> nvidia-drm "Flip event timeout on head 0" -> monitor black (KWin alive, DDC in-use). Cable replug recovered.
- Fix committed (unreleased): reference path only, enable picked screen first, sleep 4, then disable others. Stand-in tested (fake kscreen-doctor). Not hardware-tested; hypothesis that two commits avoid the timeout.

## EGPU-014 — AMD boot with eGPU: Game Mode restart loop | waiting-tester (released 0.7.253) | unclaimed | AMD / Intel install

- Report 2PWZYH (Ming, 0.7.252): Safe Detach now FIXED (tester confirmed; EGPU-002 effectively resolved). Boot with eGPU: TV on Legion logo, handheld black flashing; gamescope-session restarted every ~9 s, script died right after the rebar log line.
- Cause: AMD branch `gen_outputs="$gen_pref $(... | grep -vx "$gen_pref")"` at top level; picked screen (DP-3) = only eGPU output -> grep exit 1 -> set -e/pipefail ends script. Latent since 9984318 (2026-10-09); exposed once Ming picked the TV. NVIDIA twin lines run inside $(connector_order) (no errexit) - not affected.
- Fix 1214719 (unreleased): `|| true`; also handheld-route card-id read. Stand-in: one/two outputs, eDP pick, no pick all reach OUTPUT_CONNECTOR. Workaround for Ming until released: delete /var/lib/nvegpu/game-screen (or boot without eGPU and pick another screen).

## EGPU-015 — TV extras: TV controls + TV off at Safe Detach | waiting-tester (released 0.7.254) | unclaimed | opt-in, all setups

- Owner approved preview (Desktop "EGPU Buddy preview - TV remote (CEC).png") + LG volume suggestion, 2026-11-10. Cable pull excluded by owner.
- egpu-screen: tvset/tvkey/tvoff/tvremote; CEC via cecd D-Bus (busctl --user as uid 1000) on CecN where /sys/bus/cec/devices/cecN is under the eGPU bdf, SteamOS only; LG via webOS (volume needs CONTROL_AUDIO, requested on pairing; owner's existing pairing already allowed it). Safe Detach hooks (egpu-safe-detach NVIDIA, egpu-generic AMD) guarded by grep '"off_at_detach": true'. Plugin: TV controls tab + 2 Extras toggles. Credits: CREDITS.md.
- Tests: stand-in CEC match/cecd args, toggles off = no routes; LG mute live on owner's TV (toggled and restored during test). CEC not hardware-tested; TV off at detach not run live. Desktop app has no TV controls (not requested).

## EGPU-016 — AMD desktop Safe Detach broken | waiting-tester (released 0.7.254) | unclaimed | AMD / Intel install

- Report KXD7CD (Ming, 0.7.253): app Safe Detach -> sudo -n egpu-generic detach "a password is required" (sudoers had only rebar); Safely Eject shortcut ran NVIDIA egpu-safe-detach-ui -> "NVIDIA eGPU display card is unavailable". Same report: Game Mode detach with CEC released rc 0 + removed = CEC fix confirmed.
- Fix 201710c (unreleased): sudoers + launcher --detach AMD branch (systemd-run --user, notify-send). visudo OK. egpu-generic's desktop (KWin logout) branch not hardware-verified.

## EGPU-015b — desktop app TV parity + TV on/off | done (released 0.7.254) | unclaimed

- Uncommitted working tree: desktop-app server/QML TV card + Overview TV controls; TV on/off (egpu-screen tvkey on|off, plugin row, app buttons). Previews on Desktop updated.

## EGPU-017 — NVIDIA DP-CEC driver patch | released 0.7.255 (opt-in, rebuild on request); waiting for owner's UGREEN adapter test | unclaimed | NVIDIA, all distros

- 7fcc5e6: 180-nvidia-open-dp-cec-over-aux.patch (610 + 615 same file; 620 own copy). Compiles on all three against 7.1.8-cachyos. Off unless nvidia_drm.dp_cec=1. NOT in PKGBUILDs (would rebuild every NVIDIA driver). Untested on hardware.
- 2026-11-10: wired into all PKGBUILDs (pkgrel 610->4, 615/620->2 => every NVIDIA install rebuilds on release), Bazzite stamp includes pkgrel; option nvidia_dp_cec writes /etc/modprobe.d/egpu-buddy-dp-cec.conf (uninstall removes); CEC upgrade (power read via SendReceiveRawMessage, wake-if-off + SetActiveSource on move to TV matched by EDID PA, Switch TV button). Not released, not hardware-tested.
- (old) Next when adapter arrives: add to PKGBUILD source/sha256/prepare of the active driver dir (CachyOS, SteamOS installer and Bazzite build-modules.sh all read that list), a modprobe option toggle, then test /dev/cecN + cecd + Safe Detach/yank.

## EGPU-018 — XR glasses on the desktop like Game Mode | waiting-owner-test (released 0.7.256, untested on hardware) | unclaimed | NVIDIA reference path

- Owner: desktop app glasses pick must work as Game Mode (eGPU renders, glasses only). 0.7.256: env script handheld branch: USB-C pick -> KWIN_DRM_DEVICES=egpu:igpu (NVIDIA EGL), autostart -> egpu-screen only <glasses> (+best mode); app desktop_on egpu/both/handheld, screens carry "desk". Also glasses detection + XR_FRONT picture in app, best mode (highest res then refresh) for handheld USB-C screens.
- Risk: multi-GPU KWin (disabled by default since 2026-07 for desktop sluggishness + eDP console lifeboat) only while glasses picked. First real run must be watched by the owner; recovery = pick monitor (restart eGPU-only) or set-game-screen DP-7 + logout.

## EGPU-003 — egpu-screen CEC discovery path | waiting-user | unclaimed

- `_cec_for` reportedly has the same `/sys/class/cec` bug across all scenarios. Claude told owner but did not change it. No approval to widen the AMD-specific fix was observed.
- Next: when owner chooses this work, verify code and agree applicable scope under `CLAUDE.md`; then stand-in discovery tests. Do not silently bundle into EGPU-001.

## EGPU-004 — LD_PRELOAD in user manager environment | deferred | unclaimed

- Local memory: shim loader environment leaks to user services. Earlier update overwrote a mapped `.so` and caused repeated failover/scale-monitor crashes; those units were restarted and install copy changed to atomic replacement on the reference path.
- Next: read-only investigation if requested/prioritized; establish current state before any environment/service mutation. No live environment changes authorized by this coordination task.

## EGPU-005 — Banner A/B/C choice | waiting-user | unclaimed

- Local memory says previews on Desktop await owner's choice. Next: locate and show existing previews when this work resumes; do not choose or wire a UI change silently. These local previews are not available in a remote checkout.

## EGPU-006 — TV 4K120 mode | deferred | unclaimed

- Last memory says owner's TV runs 2560x1440@120; desired 4K120 not applied. This is stale context, not a current measurement.
- Next: establish current state and user's availability. Do not live-change an active eGPU display or use this coordination work as permission for a mode change.

## EGPU-007 — Outstanding tester checks | waiting-tester | unclaimed

- Bazzite / 1khanfusion: report after Steam sign-out recovery changes through 0.7.243; verify newer evidence before asking for an older release retest. Secure Boot was reported enabled; do not assume driver load failure is fixed.
- longface87: AR-glasses retest noted outstanding after 0.7.240.
- SilverplayerX / XG Mobile: real running-game NVIDIA-settings verification after UI/state fixes; do not interpret off-hardware UI checks as hardware confirmation.
- Next: reconcile new reports against these entries when owner supplies them. No automatic outreach.

## EGPU-008 — NV GPU Buddy real-machine verification | waiting-tester | unclaimed

- Mode released in 0.7.230; live NVIDIA status in 0.7.231. Older memory saying installer/UI are unreleased is superseded.
- Open: Decky rename on an actual desktop/laptop install, and status against a real running game. Handheld reference machine is not a substitute for that mode's tester. No desktop/laptop tester recorded.

## EGPU-009 — Shared agent coordination | done | unclaimed

- Owner request: protect working behavior and prevent either agent from losing unfinished work.
- Implemented shared root instructions, handoff, stable task ledger, history, and Claude startup reference. Runtime files and working services untouched. Remote publication is recorded in git/history; verify it before relying on a fresh remote checkout.
- Limitation: instruction-based coordination requires agents to follow the protocol. No watchdog, auto-resume, agent process control, or hardware automation added.

## EGPU-010 — Reconcile older history without dropping work | ready | unclaimed

- Local source: `/home/deck/.claude/projects/-home-deck/memory/ACTIVE_TASK.md` (about 3,500 lines) plus `MEMORY.md` and referenced memories. Recent open items and the final NV GPU Buddy section were reconciled for this initial ledger; the entire historical backlog has NOT been audited.
- Next: compare older open requests with later commits/releases/reports, promoting only still-open project work into stable entries. Record evidence for superseded/completed items rather than reviving old fixes. Never upload raw home-directory history or private reports into the public repo.
- Remote agents cannot read local-only source files; leave this task open until reconciliation or a reviewed, sanitized project-only archive is available.

## EGPU-018 — Animated repository banner | done | unclaimed | documentation only

- Owner requested replacing the old GitHub banner with the approved 18-second animation.
- Files owned: README.md, docs/assets/gear-playground.gif, AGENT_HANDOFF.md, agent-context/ACTIVE_TASK.md, agent-context/HISTORY.md.
- Validated locally: 960×400, 180 frames, 18 seconds, infinite loop; device labels centered. README uses the new GIF. Publication verification follows the commit; no app or hardware changes.
- Files currently owned: none.

## EGPU-019 touchpad (Claude) — BLOCKED for release (2026-11-10)
Commits fda8530..68b7c4e (local, not pushed). Live test left KWin with a stuck pressed button after the test process was killed
mid three-finger drag; machine restarted. Owner: must never happen again before release. Next: watchdog auto-release of held
drags, release on every exit path, test kills mid-drag in a nested KWin only. Do not push/release until done and owner OKs.
Update: prevention built + proven in isolation (fc69fd3, tests/egpu-touchpad-killtest.py ALL PASS). Next: one short live test with owner, then release on OK.
2nd live test (21:1x): stuck again on a three-finger drag on Firefox's tab bar; KDE kept the press after the touchpad released everything -> KWin/libinput side. Reboot. Drag reverted to first version (fce6b72). Next: reproduce on a separate udev seat with a nested KWin, or press the drag button on a separate virtual mouse. NO live test until proven.

EGPU-019 update: 0c58916 fixed libinput 'double tracking ID' at drag start; owner live test: three-finger drag on Firefox tab bar works, no stuck press. Not pushed/released.

EGPU-019: owner live tests pass: three-finger drag (Firefox tab bar, no stuck), 4-finger up/down + left/right, 5-finger spread/pinch (1798969). KDE window previews show icons only (KWin thumbnails on eGPU setup, not touchpad). Not pushed/released.

EGPU-019 RELEASED 0.7.258 (7c9b22f, run 42818354635, owner OK). Settings UI not previewed before release (owner said release); take real screenshots after update. Game Mode touchpad not live-tested yet. Next: KWin window previews show icons only (EGPU-020).

EGPU-020: KDE previews icons-only = kdeglobals SceneGraphBackend=software, removed (backup kept), applies next login. EGPU-021: desktop app layout (screen-sized window, masonry Extras, 2-col NVIDIA) committed locally, preview sent, awaiting OK.
EGPU-021 RELEASED 0.7.259 (68a5bf8, run 42823604923, owner OK).

- 2026-11-11 0.7.260 RELEASED (19729df, run 42876727688): AMD Titan Ridge Safe Detach recorder held attach lock 120 s -> replug ignored (ming MYFGH4). Open: ming Fire TV goes home on CEC standby (told: turn option off); touchpad dead on Legion Go S (suspect Novatek TDDI touch sleeps with panel off; ming test cmd sent).
- 2026-11-11 touchpad compat check (owner OK): daemon keeps one yes/no 'a touch reached the touchscreen while on' (/run/egpu-touchpad-reached, mtime = on time; also in the 'touchpad off' log line); report section 'Handheld screen as touchpad'. Owner OK'd for touchscreens that sleep with the panel off (pending ming/SilverplayerX data): panel on at zero brightness instead of off, ONLY on that hardware; LCD devices need a disclaimer (backlight glows), OLED fine.

- 2026-11-11: RELEASED 0.7.261 (touch-reached + touchscreen/panel state in report), 0.7.262 (Keep awake pauses without eGPU instead of switching off), 0.7.263 (2f19e4d, run 42925346645): Game Mode screen touchpad via in-process libinput -> virtual mouse (own udev seat), tap fix, slow-motion floor; "Keep the screen on for touch" (Game Mode only, fbdev picture ~3% backlight, art in /usr/local/share/egpu-buddy/touchpad-*.gray.gz); Legion Go 2 controller touchpad in Game Mode (egpu-legion-pad.service, reads hidraw 1.2 bytes 26/28; Steam gets the pad via IP deck-uhid 28de:12fb but emits no mouse in Game Mode). Untested on Legion Go S / Ally X: picture size/orientation, touch-with-panel-off. gamescope ignores MOUSE_DPI (raw counts = px).
- 2026-11-11: RELEASED 0.7.264 (79191e6, run 42933110549): keep-screen picture on the desktop too (with eGPU KWIN_DRM_DEVICES=card0 leaves the iGPU free; fbdev + debugfs trigger_hotplug if unblank alone does not light it), desktop-gesture picture variant, backlight restore floored at 10%, desktop-app toggles. NOT built: no-eGPU XR desktop (KWin owns the iGPU) = needs DisplayID primary-use VR flag (byte 259 + section checksum; amdgpu reads override only on status=on; reset via printf reset) + wp_drm_lease client; Game Mode no-eGPU impossible (gamescope has no leasing).
- 2026-11-11: RELEASED 0.7.265 (d54f596, run 42941431919): ROG Ally/XG desktop glasses passthrough (env script handheld branch + egpu-screen watcher pick/best now also for Ally when the pick is on the Ally USB-C; Wayland + NVIDIA on bus only; report 4D5H3B had "leaving KWin default"); touchpad picture via KWin DRM lease without eGPU (tested with private KWin: LIBSEAT_BACKEND=noop KWIN_DRM_DEVICES=card1 + DBUS addr, started as deck not runuser). Untested on real Ally+glasses. Ask SilverplayerX: log out/in with glasses picked + report.
- 2026-11-11: RELEASED 0.7.266: AMD Game Mode->Desktop routes desktop to eGPU screen (env AMD branch + egpu-screen _amd_pick), tvoff uses CEC without cec_remote, install try-restarts egpu-touchpad/legion-pad. Ming (LUJVV7) asked: cec-mote sleep standby turns Fire TV off or home? + keep-screen touch test.
- 2026-11-11 14:10: REBOOT for update test: CEC driver rebuilt (dp_cec param present), pacman -Syu done (disk was full: freed 4G), gamescope guard built 3.17.0 into ~/.local/gamescope-gbm (usr -> gamescope-egpu-3.17.0, usr.previous = old). After reboot check: nvidia_drm dp_cec loaded + /dev/cec*, TV on card0-DP-8 via DP-HDMI adapter, Game Mode on panel (picked DP-2, glasses unplugged), touchpad off while panel lit, new gamescope used on eGPU screen. Unreleased commits since 0.7.266 -> release 0.7.267 after checks.
- 2026-11-11 14:15: POST-REBOOT CHECKS PASSED: nvidia_drm dp_cec=Y, /dev/cec0 on the eGPU (03:00.0), TV on card0-DP-8 seen, Game Mode on ultrawide DP-7 5120x1440@144 (glasses unplugged -> pick fell through to DP-7, correct), panel off + touchpad on, gamescope = ~/.local/gamescope-egpu-3.17.0. Notes: (1) first boot 14:07:04 reset 1 s after nvidia probe, no pstore/oops, journal mid-flush -> cause unknown, 2nd boot clean; (2) new on NVIDIA scanout: "CreateScanoutBuffer: GBM allocation failed for 24x24/32x32 ARGB" = cursor images, harmless (falls back to Vulkan allocation), log noise only. NEXT: owner OK -> release 0.7.267.
- 2026-11-11 14:30: Keep-screen bug after reboot: picture flashed 0.5 s then dark (touchpad still worked). Race: session panel-off (14:08:13) checked /run/egpu-touchpad-picture before it existed, touchpad lit picture, panel-off wrote brightness 0 at 14:08:15.5. Fixed (commit above): egpu-panel re-checks before backlight + in crtc_off; touchpad re-lights after 2 s if 0. Installed live, panel set to 3% by hand. Verify on next Game Mode start. Then release 0.7.267.
- 2026-11-11 14:18: RELEASED 0.7.267 (d5ffc19, run 42964671370) on owner's request; installed here via egpu-buddy-update 0.7.267 (rc 0), touchpad restarted, picture on. Owner now testing keep-screen at the next Game Mode start.
- 2026-11-11 14:20: after 0.7.267 the picture was still invisible: bl_power left at 4 by panel-off + 3% = actual 996/472000 (raw, non-linear). Fixed (commit above): _bl_lit = bl_power 0 + 10% (actual 6537). Installed live. Waiting owner: is the picture visible now? then 0.7.268.
- 2026-11-11 14:35: XR glasses + keep-screen in Game Mode: both screens kept the touchpad picture, gamescope (our 3.17.0, picked DP-2) got EINVAL on every commit: drm.debug 'CRTC:438 Can't enable a CRTC without enabling the primary plane' = libliftoff disabled the kept eDP CRTC's planes. Fix gamescope commit f1b8ef3 in egpu.bundle (register planes except those on keep CRTC; ponytail: decided at start). Guard now keys BUILT-FROM = ver+bundle sha12 (rebuild on change). Rebuilding here via egpu-gamescope-repair (unit egpu-gs-rebuild-*, log /tmp/egpu-buddy-gamescope-repair.log); it reloads Game Mode when done. Pending: verify glasses show Game Mode + panel picture; then 0.7.268 (also has 9741a00 picture backlight 10%).
- 2026-11-11 14:31: rebuilt (BUILT-FROM 3.17.0+5f5e410799bf), Game Mode restarted via egpu-gamemode-switch: 0 flip failures, CRTC 438 (panel, fbdev picture fb 467) + CRTC 444 (glasses, gamescope 1920x1080) both active, KEEP_CONNECTOR=eDP-1. Panel backlight came back at 191691 (~40%, not our 10%): something (Steam/gamescope brightness?) restores it - open. Awaiting owner eyes-on, then 0.7.268.
- 2026-11-11 14:40: owner test: glasses unplug in keep-screen Game Mode -> panel stayed on touchpad, gamescope fell back to kept eDP-1 with no liftoff planes (EINVAL loop). Fixed: gamescope 8cd6ac6 releases keep when kept screen is the only one (registers saved planes); touchpad b68d2d4 gm_took_panel (picture gm + glasses gone + gamescope holds handheld card -> panel counts lit). Rebuilt 3.17.0+bac6600ad2cd, Game Mode restarted -> DP-7 ultrawide (glasses unplugged), picture on panel 10%, 0 flip failures. Owner to redo: glasses pick -> unplug -> replug -> monitor. Expected replug w/o re-pick: gamescope takes glasses, panel dark, touchpad works w/o picture (Game Mode holds chip).
- 2026-11-11 14:51: owner chose 'give panel back, no restart' for glasses replug. Built gamescope 3.17.0+f379a664c82a (keep_again: primary plane back to start fb, others off, planes out of liftoff, marker $XDG_RUNTIME_DIR/egpu-keep-connector) + touchpad gm_keeps (350545e). Game Mode restarted on glasses, picture on panel, 0 flip failures. Owner retesting unplug/replug/monitor. Open: panel bl comes back ~40% (191691) at Game Mode start.
- 2026-11-11 14:52: owner test plan (in order): glasses replug check -> back to monitor with glasses on -> touchpad mode on iGPU with XR glasses and NO eGPU -> switch to desktop with glasses + touchpad mode -> then CEC. Owner rule: all of this lives under the optional touchpad mode; unselected must change nothing.
- 2026-11-11 15:02: owner: replug give-back WORKED. Switch to monitor (picked LG TV DP-8) with glasses on 'failed' (owner detail pending): found keep picture stayed lit on panel+glasses under the TV Game Mode (picture_mode trusted any gamescope) -> fixed: keep valid only with marker; old glasses gamescope hung 10 s on stop (SIGKILL) + 2 SIGABRT at exit today in libseat close (wlsession_close_kms in finish_drm, race with libinput thread) on 3.17 build, also on a non-keep run -> separate, not fixed. Audio stayed HDMI across glasses unplug/replug: session ran egpu-audio local once -> now a 3 s watcher in the HANDHELD_GPU block re-runs local on the USB-C connector status change. sudo: 3 failures at 14:57 locked faillock; reset own tally (file is deck-owned) + one sudo -v OK.
- 2026-11-11 15:01: owner away; switched Game Mode to ultrawide DP-7 like the app (game-screen=DP-7, egpu-gamemode-switch + egpu-screen wake --input DP-7): 5120x1440@144, sound on X49 HDMI1, panel+glasses off. Owner wants monitor switch to work with glasses on or off.
- 2026-11-11 15:05: glasses showed stale touchpad picture under DP-7 Game Mode (fbdev buffer kept it; card1 masterless), unplug flashed panel. Fix: picture_off zeroes /dev/fbN before blank. Installed; panel picture back (10%, no glasses).
- 2026-11-11 15:08: installer 'patched driver not installed' was FALSE (grep -q + pipefail SIGPIPE); fixed d7f3565. Driver has both markers. Owner next: cable-yank eGPU, then XR glasses + touchpad on iGPU in Game Mode and Desktop.
- 2026-11-11 15:12: owner cable-yanked eGPU (Game Mode on DP-7): NOT recovering. pciehp irq thread D in snd_card_free: wireplumber+pipewire held deleted /dev/snd/controlC0 (wireplumber logged 'card removed?' but kept fd) -> PCI remove event never fired -> egpu-surprise-recover never ran. I restarted wireplumber/pipewire at 15:07:30 -> removal done, recover ran, Game Mode on iGPU panel 15:07:42. Fix: udev sound remove (ID_VENDOR_ID 0x10de) -> egpu-audio-release (3 s, restarts user sound services if PCI dev still there). Installed; helper tested both branches. Needs a real yank to prove.
- 2026-11-11 15:15: owner: Steam showed sign-in after the yank. connection_log: 15:08:14 session started logged off, 15:08:59 LogOn with saved JWT OK (no password) -> cause = Steam crash-looped 4x while stuck on dead eGPU (webhelper cores), fixed by the audio release. egpu-audio-release now skips during Safe Detach (detach stops wireplumber itself; markers as surprise-recover). Safe Detach not affected by the yank hang: it stops wireplumber (pipewire drops wireplumber's devices).
- 2026-11-11 15:16: iGPU-only (eGPU yanked) glasses + keep FAILED: stale egpu-keep-connector from killed gamescope + stock gamescope (no-eGPU branch used /usr/bin/gamescope, no shim on PATH). Fix: marker 'conn pid' (gamescope a5247a5 build 3.17.0+ee250c89ed4e), touchpad gm_keeps checks /proc/pid/comm; session else-branch: keep route with our gamescope + shim PATH when keep_screen+enabled, picture-gamemode when another screen on panel card at start. Verified: Game Mode on DP-1 glasses, picture on panel, 0 refused.
- 2026-11-11 15:23: iGPU desktop w/ glasses: lease picture 'on' 15:17:45 (bl 10%) but owner saw nothing (unverified: no debugfs snapshot then). 15:19:11 glasses DP-1 lost EDID (0 bytes, 640x480 only; XREAL asleep/taken off?) -> KWin disabled DP-1 -> touchpad picture_off -> kde_screen_off kept eDP off -> NO screen. eDP stays non-desktop=1 after real EDID restored: amdgpu cannot read eDP EDID while dark ('EDID err 2'), override not applied -> KDE hides eDP. Fixed kde_screen_off enable-if-no-other (committed). OPEN: verify lease picture actually scans out (debugfs state while on); non-desktop restore when panel dark.
- 2026-11-11 15:30: iGPU DESKTOP lease route UNRELIABLE, not solved: picture fb on eDP CRTC (debugfs: python3 fb 1920x1200 on crtc-1, bl 40%) yet owner saw NOTHING; eDP re-detect events ('No EDID found on eDP-1', 15:19:11 + 15:26:00) make KWin drop eDP and leave DP-1 'enabled' in KDE but CRTC off (640x480 ghost) -> no screen; KWin wedged (re-probe no help). Recovered by switching to Game Mode (steam-set-session + KDE logout): Game Mode on glasses DP-1, picture on panel OK. Added DIRTYFB+re-SETCRTC (untested effect). Note: keep route on iGPU passes --disable-layers --force-composition (NVIDIA env leaking into shim) - check. NEXT: decide iGPU desktop approach (lease vs alternative).
- 2026-11-11 15:40: owner: no defeatism, solve iGPU desktop. NEW ROUTE: picture_kde_on = kscreen-doctor enable eDP at gap (right+400,0) + other priority 1 + qml6 /usr/local/lib/egpu-buddy/touchpad-picture.qml (org.kde.layershell overlay, screen by name arg) showing /run/egpu-touchpad-picture.pgm; off = terminate overlay + kde_screen_off (disable if other lit else enable). Lease route code left unused (delete after verify). Installed; Game Mode route still OK. Owner to test desktop w/ glasses.
- 2026-11-11 15:43: owner rule: iGPU and eGPU routes kept apart, never fix one by changing the other. picture_kde_on gated to egpu-detect rc!=0; eGPU desktop keeps lease route (untested).
- 2026-11-11 15:46: iGPU Game Mode glasses: sound stayed on speakers (audio follow only in eGPU branch). Added follow loop inside iGPU keep route only (29b3a41; plain iGPU stock untouched). Moved sound to XREAL now by hand (egpu-audio.sh local DP-1). Takes effect from next Game Mode start.
- 2026-11-11 15:42: iGPU desktop overlay: was on glasses (LayerShell ScreenFromCompositor default) -> screenConfiguration ScreenFromQWindow; KDE DPMS-slept both screens ~15:38 (on battery after yank?) -> touchpad took picture down, never re-entered (needs panel dark). Fix: kde_route() = keep_screen && KDE && no eGPU && glasses connected -> active. Woke screens with kscreen-doctor --dpms on. Overlay running on eDP-1 now; owner to look.
- 2026-11-11 15:45: panel picture went black again = KDE battery TurnOffDisplayIdleTimeoutSec=60 (on battery since dock yank; AC has TurnOffDisplayWhenIdle=false). Not our bug. Overlay re-homing works (stayed on panel).
- 2026-11-11 15:58: owner: overlay flickered (place() screen===t never true -> hide/show 1/s) + pointer trapped on eDP (gap layout) = 'frozen desktop'. Fix: kscreen-doctor output.eDP-1.mirror.DP-1 (replica: no own area), QML compares by name, kde_screen_off uses kde_outputs + mirror.none. Installed+restarted, replica active. Owner to check picture renders on replica + pointer free.
- 2026-11-11 16:02: mirror = KDE shows mirrored desktop, overlay not drawn -> reverted to gap layout (glasses 0,0; eDP at ow+400) + pointer_to() via short-lived uinput absolute pointer (vid 1209 pid 7447) -> cursor plane on DP-1 at 956,538 verified. Owner to check picture visible + pointer free.
