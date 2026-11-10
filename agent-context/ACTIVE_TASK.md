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
