# EGPU Buddy — shared handoff

Read this first, then `agent-context/ACTIVE_TASK.md`, `AGENTS.md`, and `CLAUDE.md`.

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
