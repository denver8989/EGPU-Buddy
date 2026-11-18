# Coordination history

## 2026-11-10 — Codex

- Established a shared handoff in the actual EGPU Buddy repo. The existing global `agent-handoff` helper targets the older, separate NV-EGPU-Buddy repo and was left unchanged.
- Preserved the clean working tree's existing unpublished code commit `a3feb2d`; did not run a release or touch the live system.
- Captured the owner's existing 0.7.251 approval, recent open tasks, and incomplete historical reconciliation. Claude was observed paused at its usage limit; no keys sent or process started.
- Reviewed coordination changes for runtime impact and internal links. Publication uses only the coordination paths, based on remote master, so pending product code stays local.
- 2026-11-10 Claude: released 0.7.251 (AMD/Titan Ridge Safe Detach releases DP-CEC adapter via /sys/bus/cec). Awaiting Ming report.

- 2026-11-10 — Codex: owner-approved animated GitHub banner replaces the static README header; validated GIF dimensions, 180 frames / 18 seconds / infinite loop and label alignment. Documentation/media only, no hardware actions. EGPU-018.

- 2026-11-16 — Codex: EGPU-020, separate hosted character narration preview for EGPU Buddy and NV GPU Buddy; six selectable music beds, full breathing at longer intervals, synchronized players, skippable real intro. Main presentation URL unchanged; media-only, no hardware actions. Natural-voice reference kept local.

- 2026-11-16 — Codex: corrected EGPU-020 after owner clarification: natural narration is the default on both main and preview pages; helmet voice with fun commentary is an optional selector. Per-mode chapter timings/scripts, six music choices, and default-on-reload verified locally. Media only.

- 2026-11-17 — Codex: presentation voice labels renamed, helmet slowed 5% with synchronized scenes and pitch preservation. Owner reports corrected natural voice lacks original rhythm/emphasis; natural unchanged, short performance-context comparison prepared for review. No hardware/app changes.

- 2026-11-17 — Codex: helmet narration slowed another 5% (0.9025 playback) and shared music raised 2 dB. Author delivery confirmation pending; no audio replacement or app/hardware actions.

- 2026-11-17 — Codex: owner-approved delivery trial expanded to both full App Author narrations (53 sections). Native speech with sentence pauses and retimed slides; text/pace/integrity/browser checks passed locally. Helmet slowdown and louder music preserved. No app/hardware work.

- 2026-11-17 — Codex: optional radio-host narration with dry jokes published for both presentations (0a5b9c4), 53 sections and public three-mode playback verified. Rejected first new helmet clone; v2 local audition uses actual new 5.589 s breath and voice conversion to supplied short voice reference. Full helmet unchanged pending sample review. No app/hardware actions.

- 2026-11-17 — Codex: approved v2 helmet voice rolled out to both full tracks, new complete native-speed breathing spaced >=56.5 s. Speech slowdown baked once; per-mode runtime rate=1. All 53 sections, waveform/encoded-breath integrity, other-mode preservation and local playback/end-sync checks passed. a846b82 pushed to gh-pages; no app/hardware actions.

- Public verification of a846b82 complete: both new helmet tracks and all three voice modes/music options pass live playback checks, author remains default. No outstanding work for the approved v2 rollout.

- 2026-11-18 — Claude (remote): SilverplayerX 0.7.303 reports analysed; 0.7.304 pushed to master (XG Mobile fan mode on every attach, report: running game launch command lines), release pending on owner machine (release-local.sh). Menu-fix-off test requested from tester.
- 2026-11-18 — Claude (remote): Mod Maniac diagnostic help (Extras toggle: other Decky plugins off via Decky's disabled_plugins, recommendations for mods / Proton builds, exact restore, uninstall restore) added to unreleased 0.7.304; desktop-detach DRM logging for the Ally. Release + hardware test pending.
