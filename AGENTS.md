# Shared agent contract

Read `AGENT_HANDOFF.md` FIRST, then `agent-context/ACTIVE_TASK.md`, then `CLAUDE.md` before substantive work. These files apply to Codex, Claude, local sessions, and remote sessions alike.

## Start or resume

1. Inspect `git status --short --branch`, the current diff, recent commits, and actual remote state when publishing matters. Preserve all existing dirty work, including the index. Never use `git add -A`, reset, clean, stash, or overwrite another agent's files to make a task easier.
2. Read the task ledger, including waiting and deferred tasks. A new chat is not a new project. Preserve approvals and unfinished work across agent changes. Resolve stale memory against code, reports, and newer user instructions; do not repeat an already released fix because an old memory calls it unreleased.
3. Identify yourself and claim the relevant task in the ledger before edits. Record a unique session/chat identifier, touched files, and next checkpoint. Only one agent may own a task or edit overlapping files. If another session is active, coordinate or work on a clearly separate task. A paused or rate-limited session is not evidence its work can be discarded. Recheck the ledger and git state immediately before every mutation or publication.
4. On this machine, inspect the existing Claude session read-only with `tmux capture-pane -pt claude-rc`. Never send keystrokes, submit queued input, restart Claude, or start another Claude process to coordinate. Remote agents without this machine must say that live state is unverified.

## During work

- Track each request, discovered defect, approval, and remaining validation with a stable task ID in `agent-context/ACTIVE_TASK.md`. Add work before switching away from it. Do not silently widen scope or act on suggestions recorded as awaiting a decision.
- Use explicit states: ready, active, waiting-user, waiting-tester, deferred, done. Record evidence, scope/gate, exact next action, validation performed, validation still missing, and owner. Completion requires evidence of the requested result; committed, pushed, released, installed, and hardware-tested are separate facts.
- Preserve the scenario gates and hardware rules in `CLAUDE.md`. Coordination work does not authorize installs, updates, service restarts, display changes, detach tests, or releases. Existing specific approvals still apply to their recorded tasks.
- Checkpoint after meaningful progress, before risky operations, and before ending a turn. Do not rely on remembering to write a handoff only when explicitly asked to switch agents. If interrupted, the next agent reconciles the ledger with git and live evidence before continuing.

## End or transfer

- Update `AGENT_HANDOFF.md` with what changed, what broke (or none), dirty/unpushed work, approvals, live actions, and the next task. Update the ledger without deleting unresolved entries. Keep a concise dated entry in `agent-context/HISTORY.md`.
- Release your task ownership when stopping. Do not mark a recipient as actively working until it actually starts. Record any unfinished command/workflow and how to inspect it before retrying.
- Stage only explicit paths you own and review the staged diff. Never include another agent's staged work. Publish coordination files to the default branch so remote agents can read them; verify the remote commit and report failures honestly. If local code is ahead of the remote, publish documentation from an isolated worktree based on the remote default branch, then merge that documentation back without rewriting or discarding local work. Do not push unrelated code merely to deliver a handoff.
- `/home/deck/.local/bin/agent-handoff` currently targets the separate **NV-EGPU-Buddy** repo. Do not run it for this repo; it writes the wrong project's state. This repo's tracked handoff and ledger are the shared source of current work.
- Keep private transcripts, credentials, tester reports, and raw home-directory memories out of this public repo. Summarize project facts here. Local historical evidence is indexed in the ledger; explicitly record anything remote agents cannot access.

## Ledger entry format

`ID — title | state | owner/session | scenario`

Include: request/approval evidence; current code/commit/release facts; completed checks; missing checks or dependencies; exact next action; files currently owned. Use ISO dates with timezone for checkpoints. Never infer authorization from elapsed time or a stale ownership timestamp.
