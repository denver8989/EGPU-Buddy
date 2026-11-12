# EGPU Buddy: hard rules for every change

## Shared continuity — read before starting or resuming

Read `AGENT_HANDOFF.md`, `agent-context/ACTIVE_TASK.md`, and `AGENTS.md` before substantive work. They hold the shared task queue, ownership, approvals, validation gaps, and next actions for both Claude and Codex. Update them at meaningful checkpoints and before stopping; local Claude memory alone does not reach Codex Remote. The global `agent-handoff` helper targets a different repo; do not run it here. Preserve all unfinished tasks and other agents' dirty work. See `AGENTS.md` for the startup and transfer protocol.

These rules come from the project owner. They are not suggestions. Every fix, feature and release follows them.

## 1. One hardware scenario per fix. Everything else stays byte-for-byte as it was.

The setups below all work. A fix for one of them must not change what the others do.

| Scenario | Runtime gate (use exactly this check) |
|---|---|
| ROG Ally / ASUS XG Mobile (any OS) | `[ "$(/usr/local/sbin/egpu-detect --device 2>/dev/null)" = rog-ally ] \|\| [ -e /var/lib/nvegpu/xg-mobile-seen ]` |
| Bazzite | `grep -qsiE '^(ID\|NAME)="?bazzite' /etc/os-release` (install.sh: `IS_BAZZITE=1`) |
| SteamOS | `command -v steamos-readonly >/dev/null 2>&1` |
| AMD / Intel eGPU install | `[ "$(cat /etc/nv-egpu-buddy/gpu-vendor 2>/dev/null)" = amd ]` (python: `_installed_vendor() == "amd"`) |
| NV GPU Buddy track (EXPERIMENTAL: built-in NVIDIA card, desktop / laptop; own installer install-nv-gpu-buddy.sh) | `[ "$(cat /etc/nv-egpu-buddy/track 2>/dev/null)" = nv-gpu-buddy ]` |
| NVIDIA reference path (Legion Go 2 / Legion Go 1, SteamOS + CachyOS) | the default: no gate, and therefore **never changed by a fix for another scenario** |

- A fix goes inside the gate of the scenario where the problem was **seen in a report**. If it also touches a shared
  script (`egpu-hotplug-mount.sh`, `nv-egpu-gamescope-session`, the shim, `egpu-flight-recorder`, `install.sh`,
  `main.py`, `index.tsx`), every changed line sits inside that gate. Outside it, the old code runs unchanged.
- Gate on the **user's choice or a recorded fact**, never on a guess that can misfire on other hardware. The AMD path
  is gated on the install choice (`gpu-vendor`), not on "an AMD card seems to be on the bus".
- Combine gates when the problem is specific to two of them (e.g. ROG Ally **and** SteamOS's sddm).
- When a bug truly exists on every setup, do not fix it everywhere on your own: fix it for the reported scenario and
  ask the owner whether to widen it.
- AMD fixes go in `egpu-generic` (it exits at once unless the AMD / Intel install was chosen). NVIDIA files never run
  AMD code; AMD installs never run NVIDIA code.

- NV GPU Buddy is an alternate MODE of the same app (same version numbers), not an edition. It takes only releases whose
  notes carry an "NV GPU Buddy:" line: Game Mode plugin and desktop app experience, NVIDIA settings / driver work and
  fixes. eGPU hot-plug, dock and detach work never goes to it. Nothing built for it may change an eGPU install.

## 2. Before every commit

1. `git diff` and check every changed line in a shared file: inside the right gate? If not, move it there.
2. `bash -n` every changed shell script; `python3 -c "import ast; ast.parse(open(f).read())"` for `main.py`;
   `npm run build` in `decky-plugin/egpu-buddy` for the plugin.
3. Exercise the new logic against a stand-in (fake sysfs, fake process, fake server) where it can be done in the
   container, and say in the reply what was and was not tested on real hardware.
4. The commit message and the release note name the scope: "(Bazzite only; SteamOS and CachyOS unchanged)",
   "(ROG Ally / XG Mobile only; every other machine unchanged)", "(AMD / Intel install only; NVIDIA unchanged)".

## 3. Never damage a working machine

- Never break boot. Nothing new runs in the boot path without a time limit and a way out.
- Avoid reboots. Prefer live changes (live sysext merge, SELinux modules, udev reload, session restart).
- Never re-authorize a dock or remove a PCI device that is in use. AMD: only when no AMD card is on the bus.
- Uninstall removes everything a change installs (units, drop-ins, SELinux modules, files).

## 4. How to work

- Diagnose from the support reports first. Read every section, not only the one the tester mentioned. Do not guess:
  if the reports cannot answer it, add targeted logging for that scenario only and say so.
- Do not reinvent: reuse what already works on another setup (e.g. the SDDM desktop detach made for the ROG Ally was
  reused on Bazzite) and adapt it inside the new scenario's gate.
- Do not release when the owner says not to release. Releases are published from master with `./release-local.sh` (same steps as `.github/workflows/release.yml`, no GitHub Actions: the owner's Actions minutes are limited, 2026-11-12). Do not start any workflow unless the owner asks; `./release-local.sh --check` builds without publishing.
- Credit testers by their Discord names in README.md / TESTED.md / CREDITS.md when the owner asks.
- Replies to the owner: short and plain. Messages for testers: a short Discord-ready paragraph.

## Testers and their scenarios

| Tester (Discord) | Hardware | Scenario gate |
|---|---|---|
| (owner) | Legion Go 2 + AORUS RTX 5060 Ti, SteamOS / CachyOS; Legion Go 1 + AG03 RTX 3080 | NVIDIA reference path |
| 1khanfusion | Legion Go 2 (Z2) + AORUS RTX 5060 Ti, Bazzite 44 | Bazzite |
| SilverplayerX | ROG Xbox Ally X + ASUS XG Mobile 2025 (RTX 5070 Ti Laptop), SteamOS beta, Odyssey G9 49" | ROG Ally / XG Mobile |
| RetroMann | Legion Go 1 + AOOSTAR AG02 + RX 6800 XT, SteamOS 3.9, MSI MP275 | AMD / Intel install |
