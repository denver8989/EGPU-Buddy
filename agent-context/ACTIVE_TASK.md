# Shared task ledger

Checkpoint: 2026-11-10, Asia/Tokyo. Source: checked-out code, Claude transcript, read-only tmux capture, and durable local Claude memory. Owner `unclaimed` means no agent is currently editing that task. Waiting tasks are retained, not silently abandoned. Product changes require their own claim and scope review.

## EGPU-001 — Release AMD/Titan Ridge CEC fix | done | Claude session 43bbea5e

- Owner approved ("yes" / "release it", 2026-11-10). Released 0.7.251: commit 6912dbb on origin/master (verified), release workflow run 42738108610 succeeded, tag v0.7.251 with 5 assets.
- Validation: bash -n + stand-in sysfs test (cec bus layout). Not hardware-tested; see EGPU-002.

## EGPU-002 — Ming Safe Detach hardware confirmation | waiting-tester | unclaimed

- Legion Go S, RX 9070 XT, Trebleet Titan Ridge. Latest report BS5BEC on 0.7.250 still crashed. Trace from 22HUT6 reaches DP-CEC teardown and AUX NULL dereference; prior fixes never discovered the adapter. The causal fix remains a hardware-unconfirmed hypothesis, not a proven resolution.
- 0.7.251 released; owner given the Discord message for Ming.
- Next: on Ming's report, check egpu-generic.log for "CEC cecN on ..." / "CEC cecN released (rc N)" / "no CEC adapter registered" lines, then the kmsg trace.
- (old) Next after release: provide a short message asking Ming to update, try Safe Detach once, and send a report either way. Do not send messages externally without an explicit instruction. Inspect all report sections, especially CEC discovery/release lines, `egpu-generic.log`, and detach kernel trace.
- Success requires actual report evidence; publication alone does not close this task.
- Files owned: none.

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
