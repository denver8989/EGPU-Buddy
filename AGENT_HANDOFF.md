# EGPU Buddy — shared handoff

Read this first, then `agent-context/ACTIVE_TASK.md`, `AGENTS.md`, and `CLAUDE.md`.

## Checkpoint — 2026-11-17 (Codex voice-pacing-20261117)

- Owner asked for App Author voice and Helmet voice daft presentation labels; renamed across both presentations. Helmet slowed 5% with pitch preserved, narration scene/caption timing scaled. Natural speed remains unchanged: owner clarified corrected accent lost natural delivery, emphasis and pauses.
- A short delivery-preview/ trial compares earlier performance context with corrected speaker embedding against both prior versions. Full natural audio NOT replaced; subjective approval pending. Raw voice reference stays local. Local playback/mode/music checks passed, generated trial transcription complete. Published gh-pages cc87aa0; public player checks passed both modes, labels, helmet speed/pitch, all six music choices and pause handoff with no asset/JS errors. Delivery comparison URL returns HTTP 200.
- Nothing broke on the live machine; no app/runtime/hardware work or retained ownership. Next: review short trial before any full narration replacement.

## Checkpoint — 2026-11-16 (Codex voice-default-correction-20261116)

- Owner clarified the corrected natural voice must be DEFAULT, with the helmet voice and fun notes OPTIONAL. Full natural narration generated from the approved new reference for both presentations; the private reference recording itself stays local.
- gh-pages b988199 updates the main presentation URL and helmet-preview/: visible Narration voice selector, separate timing/scripts/audio per mode, all six music choices, natural on reload. Local browser checks passed every mode/music switch and playback handoff; 53 natural chapters passed transcription checks. Public deployed-player checks passed: natural default and reload, optional helmet, current-slide preservation, all six music choices, and mutual pause; no JavaScript or asset errors.
- No app code, hardware, services or release changes; no task ownership retained. Previous helmet-only preview was a scope misunderstanding, now corrected.

## Checkpoint — 2026-11-16 (Codex helmet-preview-20261116)

- Approved helmet character editions for both presentations are at https://denver8989.github.io/EGPU-Buddy/helmet-preview/, separate from the main landing page. Added five owner-supplied background options alongside SciFi, with six-second loop crossfades, shared selectors, and separate narration. Full breathing cycles are spaced at longer chapter breaks.
- Media-only gh-pages commits: 85df1e1 and 6903080. No app code, driver, services, GPU/display state, or releases changed. Nothing broke on the live machine. The private new natural-voice reference stays local and separate; only generated character speech and previously public demo speech are in this preview.
- The earlier local file link failed for the remote user; use the web URL above. No task ownership retained. Other app/tester tasks remain untouched.

## Checkpoint — 2026-11-10 (Codex banner-publish-20261110)

- Owner approved replacing the old repository banner with the animated gear banner. README now uses docs/assets/gear-playground.gif (18-second infinite loop, centered opening labels). Documentation/media only; nothing broke or changed on the live machine.
- Work prepared in an isolated checkout from origin/master; no unrelated code included. No task ownership retained. Prior waiting tasks remain in the ledger.


## Checkpoint — 2026-11-10 (Claude, session 43bbea5e)

- Released 0.7.251 (6912dbb, run 42738108610, v0.7.251 verified). EGPU-001 done; EGPU-002 waiting for Ming's report. No task ownership retained. Nothing broke; no live machine changes.

## Checkpoint — 2026-11-10, Asia/Tokyo

- Last writer: Codex, persistent counterpart chat `01a1c2fe-3ae3-7ef0-a7c3-0e4871d91c7c`. No task ownership is retained after this turn.
- Work done: established this repo's shared startup, task ledger, and transfer rules. No runtime code, installed files, services, GPU/display state, or Claude process changed.
- What broke: none observed. Coordination is a documented protocol; it cannot force an agent that ignores its startup instructions to comply.
- Important existing work: local `master` contains `a3feb2d`, the AMD/Titan Ridge CEC fix. At catch-up, GitHub master was `1c6c0a0`, latest published release `v0.7.250`, and `VERSION` was `0.7.250`. Recheck before publishing. The coordination publication must not publish this pending code accidentally.
- Next product action: task EGPU-001, release 0.7.251, already approved in Claude. This coordination request has not executed that release.
- Claude identity: desktop launcher `Legion-Go-2-Claude.desktop` -> `/home/deck/claude-rc-attach.sh`; existing tmux session `claude-rc`; transcript `/home/deck/.claude/projects/-home-deck/43bbea5e-9a14-4f45-a79a-d7a91173133e.jsonl`. These are local-only references, not remote-accessible files.
- Claude last observed paused at its usage limit after the owner's `yes` to 0.7.251. Its input line also showed `release it`, not submitted. Never submit it or assume a later resume has done nothing: read-only capture and check git/GitHub again.
- Hardware state: not probed or modified by this coordination work. Prior memory is not a current hardware measurement. Do not update the owner's machine while away or run detach/display tests to validate documentation.
- Historical context: local Claude memory is extensive and contains superseded claims. Recent actionable items are in the ledger; older-history reconciliation remains explicitly open as EGPU-010. Raw private history is not published.

Both agents must update these files before stopping so unfinished work and prior approvals survive the next switch.
