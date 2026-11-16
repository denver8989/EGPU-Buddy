# EGPU Buddy — shared handoff

Read this first, then `agent-context/ACTIVE_TASK.md`, `AGENTS.md`, and `CLAUDE.md`.

## Checkpoint — 2026-11-17 (Codex helmet-v2-full-20261117)

- Owner approved v2 helmet audition (“yeah use that”). Rebuilt BOTH full helmet narrations using the exact approved approach: Qwen with supplied spoken reference, Seed-VC conversion to that reference, speech pace baked at 0.9025, complete actual new Breathing.m4a (5.589 s) at NATIVE speed. No extra helmet filters. Existing jokes/text preserved.
- EGPU: 991.954 s, 40 chapters, 14 complete breath clips, minimum interval 56.537 s. NV: 330.410 s, 13 chapters, 5 complete breath clips, minimum interval 56.956 s. Both fit existing 1200 s music beds, including EGPU intro. New breath waveform preserved; encoded correlation >0.997 with actual recording. All 53 final sections pass text checks; four slower technical/credit/safety sections reviewed, no pauses over 2 s.
- IMPORTANT: new helmet mode playbackRate=1 because 0.9025 speech pace is already baked into its audio; this keeps breathing at native speed. Do NOT apply the former global 0.9025 slowdown again. Controller reads per-mode playbackRate, defaults to 1. Scene/caption/chapter timing follows new full audio.
- Author/radio audio and mode data byte/semantic hashes unchanged; App Author remains default, music -12 dB/all six choices retained. Local browser passes all 3 voices, audio for both players, voice switching/current slide, music, default/reload and mutual pause. Late-track playback has no repeated sync seeks and <0.13 s drift. gh-pages a846b82 deployed successfully; live browser checks passed new helmet audio for BOTH players, all 3 voice modes, all 6 music choices, same-slide switching, pause handoff and author default/reload. No JS/asset errors.
- No app/hardware changes or breakage observed; no ownership retained or unpushed media work. Local provenance/checks: Desktop/EGPU-Buddy-Voice-Experiments/helmet-v2-tracks/, generate_helmet_v2_sources.py, assemble_helmet_v2.py and integrate_helmet_v2.py. Private spoken reference stays local; actual breathing is included only as authorized in the combined generated tracks.

## Checkpoint — 2026-11-17 (Codex radio-host-20261117)

- Radio-host voice and adjusted daft jokes added to BOTH full presentations as optional radio mode; owner approved preview. Published gh-pages 0a5b9c4; public browser checks passed all three modes/audio/scripts, six music choices, pause handoff, author default/reload and synchronization, no asset/JS errors. Author audio unchanged, helmet still 0.9025, music -12 dB. All 53 radio sections passed transcript/integrity checks; GPU-list pace outlier reviewed as spelled model names.
- Separate helmet sample request: first Qwen clone + OLD breath preview was rejected as unlike references. Do NOT use it. Actual new Breathing.m4a now received (5.589 s); new v2 audition uses full real breath at native speed, then Seed-VC conversion to short supplied spoken voice reference, paced 0.9025. Native sample: Desktop/EGPU-Buddy-Voice-Experiments/helmet-new-sample/helmet-new-reference-v2.mp3 (16.720 s). Words checked; likeness needs owner review. No full helmet audio/breath changes published.
- No app/hardware changes or breakage observed; no ownership retained. Next: review revised helmet audition before any full voice replacement. Raw/private references remain local; generated radio speech/scripts only published. Seed-VC dependencies/models and minor compatibility edits are isolated in helmet-new-sample/, existing TTS environment not modified.

## Checkpoint — 2026-11-17 (Codex author-delivery-20261117)

- Owner explicitly approved the new delivery-trial approach for both full App Author narrations, then stressed natural talking speed. Generated 40 EGPU + 13 NV sections with the same earlier narration performance context plus corrected speaker embedding; no speed filtering. Sentence pauses retained, 0.28 s chapter gap; private reference remains local.
- All 53 sections passed transcription checks and pace review (118–189 words/minute; technical lists affect this measure). Whole-track integrity checks prove chapter samples preserved with no clipping/truncation. EGPU speech 727.280 s; NV speech 225.160 s. Scene/caption timings updated; App Author remains default. Helmet 0.9025 and music -12 dB preserved.
- Local browser passed modes, six music choices, labels/default, sync and mutual pause. Late-track playback at normal rate had no repeated seeking and <0.11 s drift in both players. gh-pages 8d93ca9 deployed successfully; public browser checks passed new narration audio/timing, default/reload, both modes, six music choices and playback handoff with no asset/JS errors. Full speech follows the approved trial approach; subjective naturalness is ultimately the owner's judgment.
- No app/hardware changes, no breakage observed. Public verification complete; no ownership retained. Local provenance and checks: Desktop/EGPU-Buddy-Voice-Experiments/author-delivery-tracks/ and generate_author_delivery.py. No raw voice references uploaded.

## Checkpoint — 2026-11-17 (Codex mix-20261117)

- Owner requests another 5% helmet slowdown and slightly louder music. gh-pages 35921ba sets helmet rate 0.9025, music +2 dB (-12 dB); synchronized scene/caption timing and pitch preservation. Local playback checks passed both presentations, modes, all six tracks and gain.
- Natural audio remains unchanged. Owner said “ok fo updated author voice”; pending clarification asks whether to apply the new delivery trial to full narration for both. Do not silently replace based on ambiguous wording while question is pending.
- No app/hardware changes or retained ownership. No breakage observed. GitHub deployment succeeded and the public page passed the same browser checks, including new gain and helmet rate; no JS/asset errors.

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
