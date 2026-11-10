import { ButtonItem, ConfirmModal, DropdownItem, Field, Focusable, ModalRoot, PanelSection, PanelSectionRow, SliderField, ToggleField, Router, showModal, staticClasses } from "@decky/ui";
import { callable, definePlugin, toaster, useQuickAccessVisible } from "@decky/api";
import { useEffect, useState, useRef } from "react";
import { FaPlug } from "react-icons/fa";
import qrcode from "qrcode-generator";

type Status = {
  track?: string;   // "nv-gpu-buddy": NV GPU Buddy mode (built-in NVIDIA card, experimental)
  present: boolean; bdf: string; driver_loaded: boolean; game_mode: boolean; game_running: boolean; ogui?: boolean;
  attach_pending: boolean; on_egpu: boolean; ally_xgm?: boolean; dock?: string; xgm?: { intro_seen_plugin?: boolean; fan?: string; curve?: number[]; light?: boolean | null; effect?: string; color?: string; speed?: string; brightness?: number; offset?: number[]; power_target?: number | null; live?: { target?: number; cap?: number; draw?: number } }; egpu_handheld?: boolean; handheld_displays?: { name: string; model: string; detail: string; xr?: boolean; brand?: string }[]; output: string;
  gm_status: { state?: string; message?: string }; desktop_status: { state?: string; message?: string };
  link: { speed: string; width: string }; displays: { name: string; enabled: boolean; model: string; detail: string; state: string }[]; audio_sink: string;
  telemetry: Record<string, string>; ts: number; resets?: { count: number; last: string };
};
type Result = { ok: boolean; message: string; rc?: number };

type NvSettings = { available: boolean; error?: string; active?: boolean; enabled?: boolean; loader?: string; settings?: Record<string, string | number>; defaults?: Record<string, string | number>;
  games?: { game: string; overridden: string[] }[] };
type LiveSettings = { available: boolean; fps?: number | null; tearing?: number | null; vrr?: number | null; sharpness?: number | null };
const nvidiaOff = callable<[], Result>("nvidia_off");
// while a game runs: per setting, what that game really received (active | inactive | overridden | default | na)
type GameNv = { running: boolean; game?: string; appid?: string; loader?: boolean; settings?: Record<string, { state: string; why: string }> };
const getNvGame = callable<[], GameNv>("get_nvidia_game_status");
const GS_LOOK: Record<string, [string, string]> = { active: ["#4caf50", "Active"], inactive: ["#f0b429", "Inactive"], overridden: ["#f0b429", "Inactive: the game's own setting"],
  default: ["#8b929a", "Default"], na: ["#8b929a", "Not used by this game"] };
const GameState = ({ st }: { st?: { state: string; why: string } }) => {
  if (!st) return null;
  const [color, label] = GS_LOOK[st.state] ?? ["#8b929a", st.state];
  return (<div style={{ fontSize: "11px", marginTop: "4px", lineHeight: 1.35 }}>
    <span style={{ color, fontWeight: 600 }}>{"\u25CF"} {label}</span>{st.state !== "active" && st.state !== "default" ? <span style={{ opacity: 0.75 }}> · {st.why}</span> : null}</div>);
};
const confirmLive = callable<[], Result>("confirm_live_setting");
type ProtonStatus = { tools: { name: string; ok: boolean }[]; ready: boolean; install: { state?: string; message?: string } };
const getProton = callable<[], ProtonStatus>("get_proton_status");
const installProton = callable<[], Result>("install_proton");
// VRR keep-or-revert: the revert itself is a timer outside the plugin (it fires even if this menu cannot be reached)
function KeepVrr({ closeModal, onDone }: { closeModal?: () => void; onDone: (kept: boolean) => void }) {
  const [left, setLeft] = useState(15);
  useEffect(() => { const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); onDone(false); closeModal?.(); return 0; } return l - 1; }), 1000); return () => clearInterval(t); }, []);
  return <ConfirmModal strTitle="Keep variable refresh rate?" strDescription={`If the screen flickers, goes black or stops responding, do nothing: it switches back by itself in ${left} s.`}
    strOKButtonText="Keep" strCancelButtonText="Switch back now" onOK={() => { onDone(true); closeModal?.(); }} onCancel={() => { onDone(false); closeModal?.(); }} closeModal={closeModal} />;
}
const getLive = callable<[], LiveSettings>("get_live_settings");
const setLive = callable<[string, number], Result>("set_live_setting");
const getNvidia = callable<[], NvSettings>("get_nvidia_settings");
const setNvidia = callable<[Record<string, string | number>], Result>("set_nvidia_settings");
const applyNvidia = callable<[], Result>("apply_nvidia_settings");
// NVIDIA settings (experimental): the Windows control panel's global settings that Linux can do (same list as the desktop app)
const NV_ROWS: { key: string; label: string; desc: string; opts: [string | number, string][] }[] = [
  { key: "low_latency", label: "Low latency mode", desc: "Frames queued ahead of the screen (DirectX 9-12 games). Ultra adds NVIDIA's latency pacing in DirectX 11 games.", opts: [["off", "Off (game decides)"], ["on", "On"], ["ultra", "Ultra"]] },
  { key: "power", label: "Power management mode", desc: "Instant. Prefer maximum performance holds the GPU clock up while a game runs and lets go when it closes. Not with a GPU clock limit or on an ASUS XG Mobile.", opts: [["adaptive", "Adaptive (driver)"], ["max", "Prefer maximum performance"]] },
  { key: "vsync", label: "Vertical sync", desc: "DirectX 9-12 and OpenGL games. Tearing in Game Mode also needs Steam's Allow tearing.", opts: [["app", "Use the program setting"], ["off", "Off"], ["on", "On"]] },
  { key: "fps_limit", label: "Max frame rate", desc: "DirectX 9-12 games. Steam's own frame limit works too; the lower one wins.", opts: [[0, "Off"], [30, "30"], [40, "40"], [45, "45"], [60, "60"], [72, "72"], [90, "90"], [120, "120"], [144, "144"], [165, "165"]] },
  { key: "aniso", label: "Anisotropic filtering", desc: "DirectX 9-11 and OpenGL games.", opts: [[0, "Program-controlled"], [2, "2x"], [4, "4x"], [8, "8x"], [16, "16x"]] },
  { key: "sharpen", label: "Image sharpening", desc: "The NVIDIA driver's own sharpening (Vulkan and OpenGL games).", opts: [[0, "Off"], [20, "Low"], [50, "Medium"], [80, "High"], [100, "Maximum"]] },
  { key: "shader_cache", label: "Shader cache size", desc: "Disk space for compiled shaders; larger means less stutter in big games (driver default 1 GB).", opts: [["default", "Driver default"], ["1", "1 GB"], ["5", "5 GB"], ["10", "10 GB"], ["unlimited", "Unlimited"]] },
  { key: "gl_threaded", label: "Threaded optimization", desc: "OpenGL games only.", opts: [["auto", "Auto"], ["on", "On"], ["off", "Off"]] },
];
// Adrenaline Settings (experimental, AMD / Intel install only): the Windows Adrenalin graphics settings Linux can do for
// games on the AMD eGPU. Steam's own Performance menu already has frame limit, tearing, VRR, HDR, FSR / NIS / integer
// scaling and sharpness, so they are not repeated here.
type AmdCard = { name?: string; bar_mb?: number; sclk?: string; mclk?: string; temp?: number | null; power?: number | null; cap?: number | null; cap_min?: number | null; cap_max?: number | null; cap_default?: number | null };
type AmdSettings = { available: boolean; al2?: boolean; fsr4_412?: { installed: boolean; state?: string; message?: string; progress?: number }; afmf?: { installed: boolean; ours: boolean; version: string; lsfg: boolean }; enabled?: boolean; active?: boolean; loader?: string; shim?: boolean; settings?: Record<string, string | number>; defaults?: Record<string, string | number>; card?: AmdCard; game_mode?: boolean; game?: boolean };
const getAmd = callable<[], AmdSettings>("get_amd_settings");
const setAmd = callable<[Record<string, string | number>], Result & { restart?: boolean }>("set_amd_settings");
const applyAmd = callable<[], Result>("apply_amd_settings");
const amdOff = callable<[], Result>("amd_off");
const setAmdCap = callable<[number], Result>("set_amd_power_cap");
const getAmdGame = callable<[], GameNv>("get_amd_game_status");
const amdAfmf = callable<[boolean], Result>("amd_afmf");
const amdFsr4 = callable<[boolean], Result>("amd_fsr4");
const AMD_ROWS: { key: string; label: string; desc: string; opts: [string | number, string][] }[] = [
  { key: "anti_lag", label: "Radeon Anti-Lag", desc: "On: one frame queued ahead of the screen (DirectX 9-11 games). Anti-Lag 2: also Mesa's open Anti-Lag 2, for games that have it built in (DirectX 12 with Proton 10, Experimental or GE-Proton; Vulkan).", opts: [["off", "Off (game decides)"], ["on", "On"], ["al2", "On + Anti-Lag 2"]] },
  { key: "fsr4", label: "FSR 4 upgrade", desc: "Games with FSR 3.1 get FSR 4 instead; pick FSR in the game's own settings. 4.1.2 and 4.1.2 Lite: one download from AMD here, then any Proton 10 or newer (Lite = the lighter INT8 model, faster on RX 7000 and older). GE-Proton's own: the version that GE-Proton build downloads by itself.", opts: [["off", "Off (game's own FSR)"], ["4.1.2", "FSR 4.1.2"], ["4.1.2-lite", "FSR 4.1.2 Lite"], ["latest", "GE-Proton's own FSR 4"]] },
  { key: "afmf", label: "Fluid Motion Frames (experimental)", desc: "Frame generation for 64-bit Vulkan and Proton games: doubles the frames shown (afmf-linux, open source; not AMD's own). Best with 60+ real FPS; adds a little latency.", opts: [["off", "Off"], ["auto", "On (auto)"], ["quality", "On (quality)"], ["performance", "On (performance)"]] },
  { key: "afmf_search", label: "Fluid Motion Frames search mode", desc: "High follows fast motion better, at a little more GPU cost.", opts: [["auto", "Auto"], ["standard", "Standard"], ["high", "High"]] },
  { key: "vsync", label: "Wait for vertical refresh", desc: "DirectX 9-12, Vulkan and OpenGL games. Tearing in Game Mode also needs Steam's Allow tearing.", opts: [["app", "Use the program setting"], ["off", "Always off"], ["on", "Always on"]] },
  { key: "aniso", label: "Anisotropic filtering", desc: "Every API: Vulkan, DirectX 9-12 and OpenGL games.", opts: [[0, "Program-controlled"], [2, "2x"], [4, "4x"], [8, "8x"], [16, "16x"]] },
  { key: "shader_cache", label: "Shader cache size", desc: "Disk space for compiled shaders; larger means less stutter in big games.", opts: [["default", "Driver default"], ["1", "1 GB"], ["5", "5 GB"], ["10", "10 GB"], ["unlimited", "Unlimited"]] },
  { key: "gl_threaded", label: "OpenGL threading", desc: "OpenGL games only.", opts: [["auto", "Auto"], ["on", "On"], ["off", "Off"]] },
];
const getStatus = callable<[], Status>("get_status");
const attach = callable<[boolean], Result>("attach");
const safeDetach = callable<[], Result>("safe_detach");
const setPowerLimit = callable<[number], Result>("set_power_limit");
const setCoreOffset = callable<[number], Result>("set_core_offset");
const setClockLimit = callable<[number], Result>("set_clock_limit");
const xgmFan = callable<[string], Result>("xgm_fan");
const xgmLight = callable<[boolean], Result>("xgm_light");
const xgmPower = callable<[number], Result>("xgm_power");
const xgmSet = callable<[string, string], Result>("xgm");
type Notes = { title: string; notes: { version: string; date: string; body: string; url: string }[]; error?: string };
const getReleaseNotes = callable<[], Notes>("get_release_notes");
// GitHub release notes, as written in RELEASE-NOTES.md: a title line, **Section** labels, "- " bullets, **bold**, [links](…)
const mdInline = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`([^`]*)`/g, "$1").split(/(\*\*[^*]+\*\*)/)
  .map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p);
const NotesBody = ({ body }: { body: string }) => (<>{body.split("\n").map((l, i) => {
  const t = l.trim(); if (!t) return null;
  if (/^[-*] /.test(t)) return <div key={i} style={{ display: "flex", gap: "6px", margin: "3px 0" }}><span>•</span><span>{mdInline(t.slice(2))}</span></div>;
  if (/^\*\*[^*]+\*\*/.test(t)) return <div key={i} style={{ marginTop: "8px", fontWeight: 700 }}>{mdInline(t)}</div>;
  return <div key={i} style={{ margin: "3px 0" }}>{mdInline(t)}</div>;
})}</>);
// "What's new": loaded from GitHub when opened. Every version since the installed one, newest first, in a scrolling window
// like SteamOS's own update notes: the D-pad / stick steps through the versions and the window scrolls with them.
function NotesModal({ closeModal }: { closeModal?: () => void }) {
  const [n, setN] = useState<Notes | null>(null);
  useEffect(() => { getReleaseNotes().then(setN).catch((e) => setN({ title: "Release notes", notes: [], error: `${e}` })); }, []);
  return (<ModalRoot closeModal={closeModal}>
    <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "4px" }}>{n?.title || "Release notes"}</div>
    {n && n.notes.length > 1 && <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>{n.notes.length} versions, newest first. Scroll for older ones.</div>}
    <Focusable flow-children="column" style={{ maxHeight: "60vh", overflowY: "auto", fontSize: "13px", lineHeight: 1.45, paddingRight: "8px" }}>
      {!n ? <div>Loading the release notes from GitHub…</div> : n.error ? <div>{n.error}</div> : !n.notes.length ? <div>No release notes found.</div> :
        n.notes.map((r) => <Focusable key={r.version} onActivate={() => {}} onFocus={(e) => (e.currentTarget as HTMLElement).scrollIntoView({ block: "nearest" })}
          style={{ padding: "8px", marginBottom: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ fontWeight: 700 }}>{r.version} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {r.date}</span></div>
          <NotesBody body={r.body} />
        </Focusable>)}
    </Focusable>
  </ModalRoot>);
}
function ReleaseNotes({ label }: { label: string }) {
  return <PanelSectionRow><ButtonItem layout="below" onClick={() => showModal(<NotesModal />)}>{label}</ButtonItem></PanelSectionRow>;
}
const xgmIntro = callable<[], string>("xgm_intro");   // the XG Mobile intro animation (data URI, or "" once shown)
const xgmIntroDone = callable<[], boolean>("xgm_intro_done");   // light-effect, brightness, offset
const XGM_COLORS: [string, string][] = [["ff0000", "Red"], ["ff6000", "Orange"], ["ffd000", "Yellow"], ["00ff40", "Green"], ["00e0ff", "Cyan"], ["0040ff", "Blue"], ["a000ff", "Purple"], ["ffffff", "White"]];
const resetClocks = callable<[], Result>("reset_clocks");
type Setup = { track?: string; machine?: string; gm_restart?: boolean; driver_building?: string; started?: number; expect?: string; driver_ready?: boolean; slow_build?: boolean; cmdline_pending?: boolean; installed_vendor?: string; egpu_on_bus?: string; untested?: string; accepted_untested?: boolean; installed_version: string; payload_version: string; needs_reboot: boolean; helpers_present: boolean; busy: boolean; step: string; rc: number | null; progress: number; can_build_driver: boolean; cmdline_missing: string; unsupported: string; log: string };
const getSetup = callable<[], Setup>("get_setup_status");
type Conflict = { id: string; name: string; url: string; why: string; evidence: string[]; removable?: boolean };
const getConflicts = callable<[], Conflict[]>("get_conflicts");   // other eGPU tools that change the same things
const removeConflicts = callable<[string[]], Result>("remove_conflicts");
const acceptUntested = callable<[], Result>("accept_untested");
const installSystem = callable<[boolean, string?], Result>("install_system");   // vendor: "nvidia" | "amd" | "" (keep)
const uninstallSystem = callable<[], Result>("uninstall_system");
const rebootSystem = callable<[], Result>("reboot_system");
const restartGamemode = callable<[], Result>("restart_gamemode");
type SteamUi = { available: boolean; enabled?: boolean; bigart?: boolean; active?: boolean; route?: boolean; offer?: boolean; pending?: boolean };
const getSteamUi = callable<[], SteamUi>("get_steam_ui_fix");
const getHandheldArt = callable<[], { svg: string; name: string }>("get_handheld_art");
const getKeepAwake = callable<[], { enabled: boolean; active: boolean; egpu: boolean; prev: number[] }>("get_keep_awake");
const setKeepAwake = callable<[boolean], Result>("set_keep_awake");
const pauseKeepAwake = callable<[], Result>("pause_keep_awake");
// Steam's own idle-sleep timers (client setting 24003 battery, 24004 plugged in; seconds, 0 = Never)
const steamSleep = (bat: number, ac: number) => {
  const v = (n: number) => { const o: number[] = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
  const f = (id: number, n: number) => [...v(id << 3), ...v(n)];
  return (window as any).SteamClient?.Settings?.SetSetting?.(btoa(String.fromCharCode(...f(24003, bat), ...f(24004, ac))));
};
const setSteamUi = callable<[boolean], Result & { restart?: boolean }>("set_steam_ui_fix");
type Upd = { needs_detach?: boolean; auto_update: boolean; available: string; state: string; checked: number; last_error: string; installed: string };
const getUpdate = callable<[], Upd>("get_update_status");
const setAutoUpdate = callable<[boolean], Result>("set_auto_update");
const checkUpdate = callable<[boolean], Result>("check_update");
const updateDetached = callable<[string], Result>("update_detached");
const pluginUpdateInfo = callable<[string], { url?: string; hash?: string }>("plugin_update_info");
// Update through Decky's own installer, as its plugin store does: the plugin is swapped in place and Steam keeps running.
// (Restarting Decky, the old way and still the fallback, reloads Steam's whole interface.) Decky asks "Update?" itself,
// so EGPU Buddy does not ask first: one confirmation.
async function updateInPlace(version: string): Promise<Result> {
  const be = (window as any).DeckyBackend;
  const info = await pluginUpdateInfo(version);
  if (!info.url || !be?.call) return checkUpdate(true);
  try { await be.call("utilities/install_plugin", info.url, "EGPU Buddy", version, info.hash, 2); }
  catch { return checkUpdate(true); }
  return { ok: true, message: `Confirm in Decky's prompt: the plugin updates in place to ${version}, then its system files install (no restart).` };
}
const popNotice = callable<[], string>("pop_notice");
type Trial = { available: boolean; main: string; beta: string; old: string; current: "old" | "main" | "beta"; to: string; from: string; installed: string; state: string; message: string; running: boolean; log: string; started: number; progress: number; step: string; acked: boolean; switch_offer?: boolean };
const getTrial = callable<[], Trial>("get_driver_trial");
const startTrial = callable<[], Result>("start_driver_trial");
const revertTrial = callable<[], Result>("revert_driver_trial");
const startBetaTrial = callable<[], Result>("start_beta_trial");
// ROG Ally / XG Mobile: menu events in the plugin log (the backend writes them only there; a no-op everywhere else)
const uiEvent = callable<[string], boolean>("ui_event");
const ui = (t: string) => { uiEvent(t).catch(() => {}); };
const ackTrial = callable<[], Result>("ack_driver_trial");
type Screen = { connector: string; name: string; state: string; ddc: boolean };
const getScreens = callable<[], Screen[]>("get_screens");
const wakeScreens = callable<[], Result>("wake_screens");
const getScreenOffer = callable<[], { connector?: string; name?: string; detail?: string; game?: boolean; handheld?: boolean; xr?: boolean; brand?: string }>("get_screen_offer");
const setGameScreen = callable<[string], Result>("set_game_screen");
const getTvControl = callable<[], { enabled: boolean; paired: string[] }>("get_tv_control");
type Addons = { usb4: boolean; report: boolean };
const getAddons = callable<[], Addons>("get_addons");
const setAddon = callable<[string, boolean], Result>("set_addon");
const getUsb4 = callable<[], { name?: string; per_lane?: number; lanes?: number; total?: number; slow?: boolean }>("get_usb4");
const makeReport = callable<[], { code: string; file: string; url: string }>("make_report");
// a QR code as an SVG (scanned with a phone, it opens the GitHub issue form with the report summary filled in)
const qrSvg = (text: string) => { const q = qrcode(0, "L"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 3, margin: 3, scalable: true }); };
const setTvControl = callable<[boolean], Result>("set_tv_control");
// TV controls (volume / mute) and "Turn the TV off at Safe Detach" (opt-in): the eGPU's CEC adapter via SteamOS's cecd, or a paired LG TV
type TvRemote = { routes: string[]; cec_remote: boolean; off_at_detach: boolean; cec_here: boolean; nv_cec?: { nvidia: boolean; supported: boolean; on: boolean; loaded: boolean; rebuild: string } };
const getTvRemote = callable<[], TvRemote>("get_tv_remote");
const setTvOption = callable<[string, boolean], Result>("set_tv_option");
const tvKey = callable<[string], Result>("tv_key");
const rebuildDriver = callable<[], Result>("rebuild_driver");
const getTouchpad = callable<[], { enabled: boolean; active: boolean; speed?: number; invert?: boolean; three?: boolean }>("get_touchpad");
const setTouchpad = callable<[boolean], Result>("set_touchpad");
const setTouchpadOption = callable<[string, string], Result>("set_touchpad_option");
let tpSpeedT: ReturnType<typeof setTimeout> | undefined;   // the slider saves (and restarts the touchpad) once it settles
const pairTv = callable<[], Result>("pair_tv");
const getGameRes = callable<[], { enabled: boolean; skip_mode?: boolean }>("get_game_res");
// Steam's own screen mode for the screen Game Mode is on: its native mode at the highest refresh rate. Native = the mode
// that moves the most pixels per second: a monitor also lists bigger modes it only downscales (a 5120x1440 ultrawide
// offers 3840x2160 at 60 Hz), so "most pixels" picked a mode the panel cannot show natively.
// Without a chosen mode Steam renders big external screens at 1920x1080 (XR glasses in ultrawide stayed 16:9). Steam's
// DisplayManager speaks protobuf; only the few fields needed are read and written (layout from Steam's own client code).
const pbFields = (buf: Uint8Array) => { let i = 0; const out: [number, any][] = [];
  const vi = () => { let r = 0, s = 0, b; do { b = buf[i++]; r += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80 && i < buf.length); return r; };
  while (i < buf.length) { const t = vi(), f = Math.floor(t / 8), w = t & 7;
    if (w === 0) out.push([f, vi()]); else if (w === 2) { const l = vi(); out.push([f, buf.subarray(i, i + l)]); i += l; }
    else if (w === 5) i += 4; else if (w === 1) i += 8; else break; }
  return out; };
const pbGet = (fs: [number, any][], n: number) => fs.filter(([f]) => f === n).map(([, v]) => v);
const modeTried = new Set<string>();   // one attempt per screen and mode: Game Mode may run a requested mode as another one
async function applyBestScreenModes() {
  const dm = (window as any).SteamClient?.System?.DisplayManager; if (!dm?.GetState || !dm?.SetMode) return;
  const cfg = await getGameRes(); if (!cfg.enabled || cfg.skip_mode) return;
  const r = await dm.GetState(); if (!r?.reply) return;
  for (const raw of pbGet(pbFields(new Uint8Array(r.reply)), 1)) {
    const f = pbFields(raw), modes = pbGet(f, 11).map((m: Uint8Array) => { const g = pbFields(m);
      const w = pbGet(g, 2)[0] ?? 0, h = pbGet(g, 3)[0] ?? 0, hz = pbGet(g, 4)[0] ?? 0;
      return { id: pbGet(g, 1)[0] ?? 0, key: `${w}x${h}@${hz}`, area: w * h, rate: w * h * hz, hz }; });
    if (pbGet(f, 6)[0] || !pbGet(f, 5)[0] || !modes.length) continue;   // the built-in screen is Steam's own business
    const best = modes.sort((a, b) => b.rate - a.rate || b.area - a.area)[0];
    if (pbGet(f, 7)[0] && pbGet(f, 10)[0] === best.id) continue;          // already on it
    // a mode set changes the display state, which calls this again: never ask twice (it looped when Game Mode ran the
    // requested mode as a slightly different one)
    const tried = `${new TextDecoder().decode(pbGet(f, 3)[0] ?? new Uint8Array())}|${best.key}`;
    if (modeTried.has(tried)) continue;
    modeTried.add(tried);
    const bytes: number[] = []; const wv = (v: number) => { while (v > 127) { bytes.push((v & 127) | 128); v = Math.floor(v / 128); } bytes.push(v); };
    wv(8); wv(pbGet(f, 1)[0] ?? 0); wv(16); wv(best.id); wv(24); wv(pbGet(f, 19)[0] ?? 0);
    await dm.SetMode(btoa(String.fromCharCode(...bytes)));
  }
}
const setGameRes = callable<[boolean], Result>("set_game_res");
const gameResFor = callable<[number, string], { set?: string }>("game_res_for");
const gameResSync = callable<[], Record<string, string>>("game_res_sync");
// a screen plugged into the eGPU while Game Mode runs on another one: offer to move (one screen at a time)
const maybeOfferScreen = async () => {
  const o = await getScreenOffer();
  if (!o.connector) return;
  // XR glasses: their picture and what passthrough means; any other screen: the plain question as before
  const big = () => <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 14px" }}>
    <Pic {...glassesPhoto(o.brand, o.name)} width={300} /></div>;
  const ask = o.game ? `Close the running game first, then use "Show Game Mode on ${o.name}" in EGPU Buddy.`
    : `Game Mode restarts on it (the screen goes dark for a few seconds). You can switch back from EGPU Buddy.`;
  showModal(<ConfirmModal strTitle={`${o.name} connected`}
    strDescription={o.xr ? <div>{big()}
        <div><b>XR glasses passthrough.</b> Play your eGPU games in the glasses: the eGPU keeps rendering, the handheld sends the picture to the glasses ({modeText(o.detail ?? "")}) and the sound moves to the glasses' speakers. No HDMI-to-USB-C adapter on the eGPU needed.</div>
        <div style={{ opacity: 0.7, marginTop: "10px" }}>{ask}</div></div>
      : o.game ? ask : `${o.detail}\n\nShow Game Mode on ${o.name}? ${ask}`}
    strOKButtonText={o.game ? "OK" : o.xr ? "Show in the glasses" : "Switch"} strCancelButtonText="Stay here"
    onOK={async () => {
      if (o.game) return;
      const r = await setGameScreen(o.connector!);
      toaster.toast({ title: appName(), body: r.message }); }} />);
};
const ICONS: Record<string, string> = {
  display: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="28" y="4" width="64" height="34" rx="3"/><path d="M52 44 H68 M60 38 V44"/></svg>`,
  handheld: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="16" y="6" width="88" height="36" rx="9"/><rect x="34" y="11" width="52" height="26" rx="2"/><circle cx="25" cy="18" r="3"/><circle cx="95" cy="30" r="3"/></svg>`,
};
// front view used for every pair of XR glasses in the screen list (picture supplied by the project author)
const XR_FRONT = "data:image/webp;base64,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";
// this handheld's own outline when its DMI name is known (main.py HANDHELD_ART); else the generic one above
let HH_NAME = "";   // the exact handheld the outline shows (e.g. "Lenovo Legion Go S"), "" with the generic outline
getHandheldArt().then((a) => { if (a?.svg) { ICONS.handheld = a.svg; HH_NAME = a.name; } }).catch(() => {});
const SCR = (inner: string) => `<svg viewBox="0 0 120 56" width="96" height="45" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
const SCREEN_ICONS = {
  tv: SCR(`<rect x="14" y="3" width="92" height="42" rx="1.5"/><path d="M28 45 L22 53 H30 M92 45 L98 53 H90"/>`),
  superwide: SCR(`<path d="M4 7 Q60 2 116 7 V38 Q60 33 4 38 Z"/><path d="M60 36 V48 M48 50 H72"/>`),
  ultrawide: SCR(`<rect x="19" y="4" width="82" height="34" rx="2"/><path d="M60 38 V48 M48 50 H72"/>`),
  monitor: SCR(`<rect x="27" y="3" width="66" height="38" rx="3"/><path d="M60 41 V50 M48 52 H72"/>`),
};
// a screen's picture from what it reports (any brand): shape from its resolution, TV from its name, or HDMI and 40" or more
const screenIcon = (model: string, detail: string) => {
  const m = detail.match(/(\d+)x(\d+)/); const r = m ? Number(m[1]) / Number(m[2]) : 16 / 9;
  const inch = Number(detail.match(/(\d+)"/)?.[1] ?? 0);
  if (r >= 3.2) return SCREEN_ICONS.superwide;
  if (r >= 2.2) return SCREEN_ICONS.ultrawide;
  if (/\bTV\b/i.test(model) || (/HDMI/.test(detail) && inch >= 40)) return SCREEN_ICONS.tv;
  return SCREEN_ICONS.monitor;
};
const glassesIcon = (_brand?: string) => ICONS.display;   // glasses without a picture: a plain screen
// The glasses' own product picture for the plug-in pop-up, from the maker's shop, loaded when shown (not shipped in the
// plugin); glasses without one, or offline, show XR_FRONT. white: the picture has a white background, cut out below.
const SHOP = "https://cdn.shopify.com/s/files/1/";
const XR_PHOTOS: [RegExp, string, boolean?, boolean?][] = [
  [/viture.*luma/i, "0762/8760/7065/files/nav-glasses-luma-series.png"],
  [/viture.*pro/i, "0762/8760/7065/files/nav-glasses-viture-pro-2.png"],
  [/viture/i, "0762/8760/7065/files/nav-glasses-the-beast.png"],
  [/rog/i, "0832/4671/1067/files/XREAL_ROG___2400x2400_09.jpg", true],
  [/xreal|nreal/i, "0832/4671/1067/files/R-6V-N-Gina-04.png"],
  [/rayneo|tcl|nxtwear/i, "0688/8642/9983/files/PP1-air_4_pro_e44fd4cd-68af-4ebc-8314-2a86c80eec11.png", false, true],   // crop: the shop logo above
  [/rokid/i, "0628/5636/4211/files/001_3d8988bd-fbc0-4eb7-be8b-e63bf17b612f.jpg", true],
];
const glassesPhoto = (brand?: string, model?: string) => {
  const m = XR_PHOTOS.find(([re]) => re.test(`${brand ?? ""} ${model ?? ""}`));
  return m ? { url: `${SHOP}${m[1]}?width=600`, white: !!m[2], crop: !!m[3] } : { url: XR_FRONT, white: false, crop: false };
};
// White around the glasses -> transparent: flood fill from the picture's edges over near-white, so a white-background
// picture sits on the dark pop-up like the others (white inside the glasses, e.g. reflections, is not reached).
const cutWhite = (url: string) => new Promise<string>((ok, fail) => {
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onerror = fail;
  img.onload = () => {
    const c = document.createElement("canvas"), W = c.width = img.naturalWidth, H = c.height = img.naturalHeight;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), p = d.data, seen = new Uint8Array(W * H), st: number[] = [];
    const lo = (k: number) => Math.min(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]);
    const bg = (k: number) => lo(k) > 205 && Math.max(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]) - lo(k) < 20;
    // edge pixels are part white: fade them and take the white back out of their colour, so no light halo is left
    const clear = (k: number) => {
      const a = Math.max(0, Math.min(255, (247 - lo(k)) * 8)); p[k * 4 + 3] = a;
      if (a > 0 && a < 255) for (let i = 0; i < 3; i++) p[k * 4 + i] = Math.max(0, Math.round((p[k * 4 + i] - 255 * (1 - a / 255)) / (a / 255)));
    };
    for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
    while (st.length) {
      const k = st.pop()!; if (seen[k] || !bg(k)) continue; seen[k] = 1;
      clear(k);
      const x = k % W; if (x > 0) st.push(k - 1); if (x < W - 1) st.push(k + 1); if (k >= W) st.push(k - W); if (k < W * (H - 1)) st.push(k + W);
    }
    // background showing through gaps in the frame (between the arms, above the lenses): enclosed pure-white areas
    // too, when bigger than a highlight
    const pure = (k: number) => lo(k) > 240 && Math.max(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]) - lo(k) < 12;
    for (let k0 = 0; k0 < W * H; k0++) {
      if (seen[k0] || !pure(k0)) continue;
      const area: number[] = [], q = [k0]; seen[k0] = 2;
      while (q.length) {
        const k = q.pop()!; area.push(k); const x = k % W;
        for (const n of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) if (n >= 0 && n < W * H && !seen[n] && bg(n)) { seen[n] = 2; q.push(n); }
      }
      if (area.length > W * H / 2000) for (const k of area) clear(k);
    }
    // the outermost 2 px of the glasses are still a light grey blend with the white: fade those by how light they are
    for (let pass = 0; pass < 2; pass++) {
      const rim: number[] = [];
      for (let k = W; k < W * (H - 1); k++) {
        const x = k % W; if (x === 0 || x === W - 1 || p[k * 4 + 3] < 255 || lo(k) < 120) continue;
        if (p[(k - 1) * 4 + 3] < 128 || p[(k + 1) * 4 + 3] < 128 || p[(k - W) * 4 + 3] < 128 || p[(k + W) * 4 + 3] < 128) rim.push(k);
      }
      for (const k of rim) {
        const a = Math.max(0, Math.min(255, Math.round((250 - lo(k)) * 2))); p[k * 4 + 3] = a;
        if (a > 0 && a < 255) for (let i = 0; i < 3; i++) p[k * 4 + i] = Math.max(0, Math.round((p[k * 4 + i] - 255 * (1 - a / 255)) / (a / 255)));
      }
    }
    g.putImageData(d, 0, 0); ok(c.toDataURL("image/png"));
  };
  img.src = url;
});
const Pic = ({ url, white, crop, width, minH = 180 }: { url: string; white?: boolean; crop?: boolean; width: number; minH?: number }) => {
  const [src, setSrc] = useState(white ? "" : url);
  useEffect(() => { if (white) cutWhite(url).then(setSrc, () => setSrc(XR_FRONT)); }, [url, white]);
  const own = src !== XR_FRONT;
  return <img src={src || undefined} onError={() => setSrc(XR_FRONT)} style={{ width: `${width}px`, height: "auto", display: "block", minHeight: src ? undefined : `${minH}px`,
    ...(own && crop ? { aspectRatio: "4 / 3", objectFit: "cover", objectPosition: "50% 85%" } : {}),
    ...(own && url !== XR_FRONT ? { filter: "drop-shadow(0 0 14px rgba(150,180,255,0.22))" } : {}) }} />;   // a soft glow keeps dark glasses visible on the dark pop-up
};
// "3840x1200 @ 60 Hz" -> "Ultrawide 32:9 · 3840x1200 @ 60 Hz" when the screen is that wide (glasses switched to ultrawide)
const modeText = (detail: string) => { const m = detail.match(/(\d+)x(\d+) @ \d+ Hz/); if (!m) return "";
  return (Number(m[1]) / Number(m[2]) >= 3 ? "Ultrawide 32:9 · " : "") + m[0]; };
// every screen Game Mode can go to while the eGPU is attached: the handheld itself, screens on its USB-C (XR glasses),
// and the eGPU's monitors/TVs (an off TV only when TV control can switch it on)
const screenTargets = (s: Status, tvWakes: boolean) => [
  { name: "eDP-1", label: "the handheld screen", detail: "Games still run on the eGPU", icon: ICONS.handheld, xr: false },
  ...(s.handheld_displays ?? []).map((d) => ({ name: d.name, label: d.model || d.name, xr: !!d.xr, icon: d.xr ? glassesIcon(d.brand) : screenIcon(d.model || "", d.detail || ""), photo: d.xr ? glassesPhoto(d.brand, d.model) : null,   // that model's own picture, as in the pop-up
    detail: `${d.xr ? "XR glasses passthrough" : "External display on the handheld's USB-C"} · ${modeText(d.detail)} · games run on the eGPU` })),
  ...s.displays.filter((d) => d.state !== "off" || tvWakes).map((d) => ({ name: d.name, label: d.model || d.name, xr: false, icon: screenIcon(d.model || "", d.detail || ""),
    detail: d.state === "off" ? "Off: choosing it turns it on" : d.detail })),
];
const screenState: Record<string, string> = { "in-use": "on", "other-input": "other input", standby: "asleep", off: "off" };
const vt = (v: string) => (v.match(/\d+/g) ?? ["0"]).slice(0, 3).reduce((a, x) => a * 1000 + Number(x), 0);

// NV GPU Buddy mode (experimental, a BUILT-IN NVIDIA card): the same plugin under its own name, without the eGPU parts.
// Every `nvb` branch below is for that mode only; an eGPU install never reports the track and renders as before.
const APP_NAME = { v: "EGPU Buddy" };
const appName = () => APP_NAME.v;
const PLUGIN_VERSION = "0.7.223";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
// The percentage follows real stages (and real compile output); the running clock shows it is alive between stage changes.
const Progress = ({ pct, title, step, started, expect }: { pct: number; title: string; step: string; started?: number; expect?: string }) => (
  <div style={{ width: "100%", boxSizing: "border-box", padding: "4px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}><span>{title}</span><span>{Math.round(pct)}%</span></div>
    <div style={{ width: "100%", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: "#1a9fff", transition: "width .4s" }} />
    </div>
    <div style={{ fontSize: "12px", marginTop: "4px", whiteSpace: "normal" }}>{step}</div>
    <div style={{ fontSize: "11px", opacity: 0.75, marginTop: "2px", whiteSpace: "normal" }}>{started ? `${mmss(Date.now() / 1000 - started)} elapsed` : ""}{expect ? ` · usually ${expect}` : ""}</div>
    <div style={{ fontSize: "11px", opacity: 0.75, marginTop: "2px", whiteSpace: "normal" }}>You can close this menu: it continues, and a notification appears when it is done.</div>
  </div>
);

// one line per row: values are kept short below, and anything still too long for a narrow screen ends in "…" instead of
// breaking mid-word onto a second line ("RTX 5 / 060 Ti", seen on a 5120x1440 monitor and on the handheld panel)
const Row = ({ k, v }: { k: string; v: string }) => (
  <PanelSectionRow><Field label={k} focusable={false} bottomSeparator="none"><span style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", maxWidth: "100%" }}>{v || "—"}</span></Field></PanelSectionRow>
);
// the screen's own name ("X49 V") instead of its connector ("DP-7") where the EDID gives one
const screenName = (s: Status) => s.output.startsWith("eDP") ? "the handheld screen" : [...s.displays, ...(s.handheld_displays ?? [])].find((d) => d.name === s.output)?.model || s.output;
const gpuName = (n?: string) => (n ?? "").replace(/^NVIDIA\s+(GeForce\s+)?/i, "");
// "alsa_output.pci-0000_03_00.1.HiFi__HDMI1__sink" -> "eGPU HDMI 1"; the built-in card -> "Built-in"
const audioName = (sink: string, bdf: string) => {
  if (!sink) return "";
  const port = sink.match(/(HDMI|DP)(\d*)/i);
  const busDev = bdf.replace(/^0000:/, "").replace(/\.\d$/, "").replace(":", "_");
  if (busDev && sink.includes(busDev)) return `eGPU${port ? ` ${port[1].toUpperCase()}${port[2] ? " " + port[2] : ""}` : ""}`;
  if (/bluez/i.test(sink)) return "Bluetooth";
  if (/usb/i.test(sink)) return "USB audio";
  if (/pro-output|analog|speaker/i.test(sink)) return "Built-in";
  return sink.replace(/^alsa_output\.(pci-0000_)?/, "").replace(/\.(pro-output-0|.*__sink)$/, "");
};

function stateLine(s: Status): string {
  if (!s.present) return s.driver_loaded ? "eGPU off the bus (driver still loaded)" : "No eGPU attached";
  if (s.game_mode) return s.on_egpu ? `Attached — Game Mode on ${screenName(s)}` : s.egpu_handheld ? `Attached — Game Mode on ${screenName(s)}, games on the eGPU` : "eGPU present — Game Mode on the handheld screen";
  return "eGPU present (Desktop)";
}

// Beta driver trial: a progress screen that opens by itself whenever Game Mode starts while a trial runs (it restarts
// twice: onto the handheld at the Safe Detach, onto the monitor at the attach), and once more with the result.
let trialOpen = false;
function TrialModal({ closeModal }: { closeModal?: () => void }) {
  const [t, setT] = useState<Trial | null>(null);
  useEffect(() => { let alive = true; const tick = async () => { try { const x = await getTrial(); if (alive) setT(x); } catch { /* backend restarting */ } };
    tick(); const i = setInterval(tick, 1000); return () => { alive = false; clearInterval(i); }; }, []);
  const done = !!t && !t.running;
  const back = !!t && (t.state === "reverting" || t.state === "reverted");
  const close = () => { trialOpen = false; if (done) ackTrial(); closeModal?.(); };
  return (
    <ConfirmModal strTitle={!t ? "NVIDIA driver" : done ? (t.state === "kept" ? `Driver ${t.to} installed` : t.state === "reverted" ? `Back on driver ${t.from}` : "Driver switch failed") : back ? `Returning to driver ${t.from}` : `Installing driver ${t.to}`}
      strDescription={!t ? "…" : done
        ? <div style={{ fontSize: "14px", color: t.state === "kept" ? "#4caf50" : t.state === "failed" ? "#ff6b6b" : "#f0b429" }}>{t.message}</div>
        : <Progress pct={t.progress} title={back ? "Reverting" : "Installing"} step={t.step} started={t.started} expect={back ? "3-5 minutes" : "5-20 minutes"} />}
      bAlertDialog strOKButtonText={done ? "OK" : "Working… (B hides this)"} bOKDisabled={!done} onOK={close} onCancel={close} closeModal={close} />
  );
}
const maybeShowTrial = async () => {
  if (trialOpen) return;
  const t = await getTrial();
  const recent = t.started && Date.now() / 1000 - t.started < 7200;
  if (recent && (t.running || (["kept", "reverted", "failed"].includes(t.state) && !t.acked))) { trialOpen = true; showModal(<TrialModal />); return; }
  // 0.7.220: driver 615 is the main driver. A 610 machine is asked once per Game Mode start (Later = next time), only on
  // the eGPU's screen with no game running (the backend checks that); any outcome of the switch ends the asking.
  if (t.switch_offer && !switchAsked) {
    switchAsked = true; trialOpen = true;
    showModal(<ConfirmModal strTitle={`Switch to NVIDIA driver ${t.main}?`}
      strDescription={`Driver ${t.main} is now EGPU Buddy's main driver: most testers run it without problems. The eGPU is safely detached, the driver is downloaded from NVIDIA (about 530 MB) and built on this device (10-20 minutes, about 6 GB free space needed), then the eGPU is attached with it and checked. If it does not come up, your current driver ${t.old} is put back and attached again by itself, also after a reset or hang. Keep the charger and the eGPU connected. Later: asked again next time; you can also switch any time in Setup & updates.`}
      strOKButtonText="Switch now" strCancelButtonText="Later"
      onOK={async () => { trialOpen = false; const r = await startTrial(); toaster.toast({ title: appName(), body: r.message, duration: 10000 }); }}
      onCancel={() => { trialOpen = false; }} />);
  }
};
let switchAsked = false;   // per plugin load: a new Game Mode session (Steam restart) asks again

// Steam menu fix for Big Art mode (NVIDIA eGPU only, opt-in): asked once per Game Mode start while Big Art is on and the
// fix is off (an attach restarts Game Mode, so a new attach asks again); and when it is on but this Steam started without
// it (after an update or an attach), a Game Mode restart is offered once. The backend decides: NVIDIA route, no game.
let suiAsked = false, suiPendingAsked = false, suiOpen = false;
const maybeOfferSteamUi = async () => {
  if (suiOpen || trialOpen) return;
  const o = await getSteamUi();
  if (o.offer && !suiAsked) {
    suiAsked = true; suiOpen = true;
    showModal(<ConfirmModal strTitle="Fix the Big Art menu on the NVIDIA eGPU?"
      strDescription="Big Art mode is on. On an NVIDIA eGPU, Steam's own interface compositor cannot start, so the main menu slides in over a black bar. EGPU Buddy can supply what it is missing (on the NVIDIA GPU, no Steam file is changed). Game Mode restarts once to apply it. You can switch it off any time in Setup."
      strOKButtonText="Turn on and restart" strCancelButtonText="Not now"
      onOK={async () => { suiOpen = false; const r = await setSteamUi(true); toaster.toast({ title: appName(), body: r.message });
        if (r.ok && r.restart) { const g = await restartGamemode(); toaster.toast({ title: appName(), body: g.message }); } }}
      onCancel={() => { suiOpen = false; }} />);
  } else if (o.pending && !suiPendingAsked) {
    suiPendingAsked = true; suiOpen = true;
    showModal(<ConfirmModal strTitle="Steam menu fix: restart Game Mode?"
      strDescription="The Steam menu fix for Big Art mode is on, but Steam was started without it (after an update or a new attach). Restarting Game Mode applies it."
      strOKButtonText="Restart Game Mode" strCancelButtonText="Later"
      onOK={async () => { suiOpen = false; const g = await restartGamemode(); toaster.toast({ title: appName(), body: g.message }); }}
      onCancel={() => { suiOpen = false; }} />);
  }
};

// ROG Ally / XG Mobile: the page (main, details, setup, NVIDIA settings) is kept for the plugin's lifetime, so a re-render
// of the panel does not drop the user back on the main page. Set from the status (ally_xgm); elsewhere it always opens on main.
const keepPage: { on: boolean; tab: "main" | "details" | "setup" | "nvidia" | "amd" | "tv" } = { on: false, tab: "main" };
// ROG Ally / XG Mobile: opening an NVIDIA settings dropdown remounts the menu there, which dropped the picked value before
// Apply (SilverplayerX, 0.7.226: "nothing can be changed"). Kept here like the page, on that machine only.
const keepNv: { v: Record<string, string | number> | null } = { v: null };
function Content() {
  const visible = useQuickAccessVisible();
  const [tab, setTab_] = useState<"main" | "details" | "setup" | "nvidia" | "amd" | "tv">(keepPage.on ? keepPage.tab : "main");
  const setTab = (t: "main" | "details" | "setup" | "nvidia" | "amd" | "tv") => { ui(`page ${keepPage.tab} -> ${t}`); keepPage.tab = t; setTab_(t); };
  useEffect(() => { ui(`menu mounted on page ${keepPage.on ? keepPage.tab : "main"} (kept: ${keepPage.on})`); return () => ui(`menu unmounted (page ${keepPage.tab})`); }, []);
  useEffect(() => { ui(`panel ${visible ? "open" : "closed"} (page ${keepPage.tab})`); }, [visible]);
  const [nv, setNv] = useState<NvSettings | null>(null);
  const [nvEdit, setNvEdit_] = useState<Record<string, string | number> | null>(keepPage.on ? keepNv.v : null);
  const setNvEdit = (v: Record<string, string | number> | null) => { if (keepPage.on) keepNv.v = v; setNvEdit_(v); };
  const [live, setLive_] = useState<LiveSettings | null>(null);
  const [amd, setAmdS] = useState<AmdSettings | null>(null);
  const [amdEdit, setAmdEdit] = useState<Record<string, string | number> | null>(null);
  const [ags, setAgs] = useState<GameNv | null>(null);
  const [pr, setPr] = useState<ProtonStatus | null>(null);
  const [gs, setGs] = useState<GameNv | null>(null);
  const [logOpen, setLogOpen] = useState<"" | "setup" | "trial">("");   // logs stay folded away unless asked for
  const [su, setSu] = useState<Setup | null>(null);
  const [up, setUp] = useState<Upd | null>(null);
  const [tv, setTv] = useState<{ enabled: boolean; paired: string[] } | null>(null);
  const [trm, setTrm] = useState<TvRemote | null>(null);
  const [tpad, setTpad] = useState<{ enabled: boolean; active: boolean; speed?: number; invert?: boolean; three?: boolean } | null>(null);
  const [ad, setAd] = useState<Addons | null>(null);
  const [usb4, setUsb4] = useState<{ name?: string; per_lane?: number; lanes?: number; total?: number; slow?: boolean }>({});
  const [report, setReport] = useState<{ code: string; file: string; url: string } | null>(null);
  const [gr, setGr] = useState<{ enabled: boolean } | null>(null);
  const [sui, setSui] = useState<SteamUi | null>(null);
  const [awake, setAwake] = useState<{ enabled: boolean; active: boolean; egpu: boolean; prev: number[] } | null>(null);
  useEffect(() => { if (visible && tab === "setup") getKeepAwake().then(setAwake).catch(() => setAwake(null)); }, [visible, tab]);
  const [tr, setTr] = useState<Trial | null>(null);
  const staleChecked = useRef(false);
  const [s, setS] = useState<Status | null>(null);
  const [scr, setScr] = useState<Screen[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pl, setPl] = useState<number | null>(null);
  const [off, setOff] = useState(0);
  const [clk, setClk] = useState<number | null>(null);
  const [pt, setPt] = useState<number | null>(null);   // ASUS XG Mobile power target (W)
  const [xoff, setXoff] = useState<[number, number] | null>(null);
  const [intro, setIntro] = useState<{ src: string; fading: boolean } | null>(null);   // XG Mobile intro, once
  const introAsked = useRef(false);   // ASUS XG Mobile core / memory clock offsets (MHz)   // laptop-class GPUs: a GPU clock limit is their power control

  const refresh = async () => { try { const st = await getStatus(); keepPage.on = !!st?.ally_xgm; setS(st); setSu(await getSetup()); const u = await getUpdate(); setUp(u); setTv(await getTvControl()); setTrm(await getTvRemote()); setTpad(await getTouchpad()); const a = await getAddons(); setAd(a); setUsb4(a.usb4 ? await getUsb4() : {}); setGr(await getGameRes()); setTr(await getTrial()); setSui(await getSteamUi());
    // the hourly check only counts awake time: after a night of sleep the status is stale, so re-check on open (wall clock)
    if (!staleChecked.current && (!u.checked || Date.now() / 1000 - u.checked > 600)) { staleChecked.current = true; checkUpdate(false); }
  } catch (e) { setMsg(`status error: ${e}`); } };
  // NVIDIA settings: read when Setup or the page opens (they also scan the Steam library for games' own dxvk.conf)
  useEffect(() => { if (visible && (tab === "setup" || tab === "nvidia")) getNvidia().then((n) => { setNv(n); if (tab === "setup") setNvEdit(null); }).catch(() => setNv(null)); }, [visible, tab]);
  // Adrenaline Settings (AMD / Intel install): read when Setup opens, and every 3 s on the page (the card's live readouts)
  useEffect(() => { if (!visible || (tab !== "setup" && tab !== "amd")) return; const f = () => getAmd().then(setAmdS).catch(() => setAmdS(null)); f();
    if (tab !== "amd") return; const g = () => getAmdGame().then(setAgs).catch(() => setAgs(null)); g();
    const t = setInterval(() => { f(); g(); }, 3000); return () => clearInterval(t); }, [visible, tab]);
  useEffect(() => { if (visible && tab === "amd") getProton().then(setPr).catch(() => setPr(null)); }, [visible, tab]);
  useEffect(() => { if (visible && tab === "nvidia" && s?.game_mode) getLive().then(setLive_).catch(() => setLive_(null)); }, [visible, tab, s?.game_mode]);
  useEffect(() => { if (visible && tab === "nvidia") getProton().then(setPr).catch(() => setPr(null)); }, [visible, tab]);
  // the live status follows the game while the page is open (every 3 s; read-only)
  useEffect(() => { if (!visible || tab !== "nvidia") return; const f = () => getNvGame().then(setGs).catch(() => setGs(null)); f(); const t = setInterval(f, 3000); return () => clearInterval(t); }, [visible, tab]);
  // DDC/CI reads are slow-ish and some screens dislike polling: read once when details open
  useEffect(() => { if (visible && tab === "details") getScreens().then(setScr).catch(() => setScr(null)); }, [visible, tab]);
  useEffect(() => { if (!visible) return; refresh(); const t = setInterval(refresh, su?.busy ? 1000 : 3000); return () => clearInterval(t); }, [visible, su?.busy]);

  // Bazzite: with OpenGamepadUI running, Steam's running-app entry can be OpenGamepadUI itself; there the backend's check decides
  const gameUp = !!(s?.game_running || (!s?.ogui && Router.MainRunningApp));
  // ROG Ally / XG Mobile (s.ally_xgm, the CLAUDE.md gate): a setting's control stays enabled while it is applied. Disabling the
  // control the controller is on moves Steam's focus to the top of the panel, so after every change the user had to scroll
  // back (SilverplayerX, 0.7.221). A second press while one runs is ignored instead. Everywhere else: as before.
  const keepFocus = !!s?.ally_xgm;
  const lock = busy && !keepFocus;
  const running = useRef(false);
  const run = async (fn: () => Promise<Result>) => { if (keepFocus && running.current) { ui("change ignored: one is still running"); return; } running.current = true;
    const t0 = Date.now(); ui(`change started (page ${keepPage.tab})`);
    setBusy(true); try { const r = await fn(); setMsg(r.message); ui(`change done in ${Date.now() - t0} ms: ${r.ok ? "ok" : "failed"} ${String(r.message ?? "").slice(0, 120)}`); } catch (e) { setMsg(`${e}`); ui(`change error: ${e}`); } finally { running.current = false; setBusy(false); refresh(); } };

  const nvb = s?.track === "nv-gpu-buddy" || su?.track === "nv-gpu-buddy";
  APP_NAME.v = nvb ? "NV GPU Buddy" : "EGPU Buddy";
  const tel = s?.telemetry ?? {};
  const plMin = Number(tel["power.min_limit"] ?? 100), plMax = Number(tel["power.max_limit"] ?? 320);
  const plNow = pl ?? Math.round(Number(tel["power.limit"] ?? plMax));
  // laptop-class GPUs (ASUS XG Mobile) report the limits as [N/A]: the dock firmware owns the power, nvidia-smi -pl cannot set it
  const plOk = [plMin, plMax, plNow].every(Number.isFinite) && plMax > plMin;
  // ASUS XG Mobile: the cap the GPU really runs at (enforced.power.limit, queried only for it) where power.limit is [N/A]
  const xg = !!s?.dock?.includes("XG Mobile");
  const xgCap = xg && !Number.isFinite(Number(tel["power.limit"])) && Number.isFinite(Number(tel["enforced.power.limit"])) ? Math.round(Number(tel["enforced.power.limit"])) : null;
  // laptop-class GPUs: the clock limit spans 600 MHz to the GPU's own maximum (clocks.max.graphics)
  const clkMax = Math.round(Number(tel["clocks.max.graphics"]) || 0), clkMin = Math.min(600, clkMax);
  // ASUS XG Mobile: power target 40 W to its cap (at the cap = no target), fan mode and lights through egpu-xgm
  const xgTop = Math.round(Number(tel["enforced.power.limit"])) || 115;
  const xgLive = s?.xgm?.live ?? {};
  const ptNow = pt ?? (s?.xgm?.power_target || xgTop);
  const xoffNow: [number, number] = xoff ?? [s?.xgm?.offset?.[0] ?? 0, s?.xgm?.offset?.[1] ?? 0];
  const lightOn = s?.xgm?.light !== false;
  // the XG Mobile intro: the first time the plugin shows the XG Mobile controls, once. Marked shown only when it has played
  // to the end or was tapped away, so closing the panel early shows it again next time
  const introTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endIntro = () => { if (introTimer.current) clearTimeout(introTimer.current); introTimer.current = null
    setIntro((i) => i && { ...i, fading: true }); xgmIntroDone().catch(() => {})
    setTimeout(() => setIntro(null), 600); };
  useEffect(() => {
    if (!visible) {   // the panel closed before the intro ended: not counted, it plays again the next time
      if (introTimer.current) { clearTimeout(introTimer.current); introTimer.current = null; introAsked.current = false
        setIntro(null); }
      return;
    }
    if (introAsked.current || !s?.present || !s.driver_loaded || !s.dock?.includes("XG Mobile") || !s.xgm || s.xgm.intro_seen_plugin) return;
    introAsked.current = true;
    // a distinct URL per play (a media type parameter): Chromium shares one animation timeline per image URL, so a
    // repeat after the panel was closed would start mid-way. Plain data: URLs, like the plugin's other pictures
    xgmIntro().then((d) => {
      if (d) { setIntro({ src: d.replace("data:image/webp;", `data:image/webp;play=${Date.now()};`), fading: false }); introTimer.current = setTimeout(endIntro, 7100); } }).catch(() => {});
  }, [s, visible]);
  const lightFx = (fx?: string, rgb?: string, speed?: string) => run(() => xgmSet("light-effect", `${fx || s?.xgm?.effect || "static"}:${rgb || s?.xgm?.color || "ff0000"}:${speed || s?.xgm?.speed || "normal"}`));
  const clkNow = clk ?? (Math.round(Number(tel["clock_limit"])) || clkMax);   // the applied limit (kept by the helper), else none
  const controlsOk = !!(s?.present && s?.driver_loaded && (s?.on_egpu || nvb));
  // "mounted" for uninstall purposes: the driver is loaded, so /usr cannot be written and the
  // extension cannot be unmerged. Detaching is what clears it.
  const egpuMounted = !!(s?.driver_loaded);
  const tvWakes = !!tv?.enabled && !!tv?.paired.length;   // TV control can switch a TV that is off on
  const askUninstall = () => showModal(<ConfirmModal strTitle={`Uninstall ${appName()}?`} bDestructiveWarning strOKButtonText="Uninstall"
    strDescription={nvb ? "The system integration is removed and the machine goes back to how it was. The NVIDIA driver the machine had before NV GPU Buddy comes back (on SteamOS: none, it has no NVIDIA driver of its own)."
      : (egpuMounted ? "The eGPU is safely detached first: Game Mode moves to the handheld screen for a few seconds. " : "") + "Then the system integration is removed and the machine goes back to how it was."}
    onOK={() => run(uninstallSystem)} />);
  const WHAT = nvb ? "Installs NVIDIA settings and their game loader, power and clock controls, the Big Art menu fix, the desktop app, and EGPU Buddy's patched NVIDIA driver with its userspace pinned to it. No eGPU parts. Backups are kept." : "Installs the hot-plug scripts, the Game Mode session, the GBM gamescope, the boot policy, the desktop app, the patched hot-unplug driver with the NVIDIA userspace pinned to it, and the kernel parameters. Backups are kept.";
  // Before installing: other eGPU tools that change the same settings (primary GPU, Game Mode session, boot GPU) conflict
  // with EGPU Buddy. Offer to remove them with their own uninstaller; installing alongside them stays possible.
  const withConflictCheck = (next: () => void) => {
    getConflicts().then((cs) => {
      if (!cs?.length) { next(); return; }
      const rm = cs.filter((c) => c.removable);   // a driver built into the system image cannot be removed from here
      const text = cs.map((c) => `${c.name}${c.url ? ` (${c.url})` : ""}: ${c.why}. Found: ${c.evidence.slice(0, 3).join(", ")}`).join("\n\n");
      showModal(<ConfirmModal strTitle={cs.length > 1 ? "Conflicts found" : `${cs[0].name} found`} bDestructiveWarning
        strDescription={text + "\n\nRunning EGPU Buddy alongside leads to black screens, a GPU that does not switch, or a driver without the eGPU fixes."
          + (rm.length ? ` Uninstall ${rm.map((c) => c.name).join(" and ")} now (with ${rm.length > 1 ? "their" : "its"} own uninstaller), then install EGPU Buddy? A reboot is recommended afterwards.` : "")}
        strOKButtonText={rm.length ? "Uninstall, then continue" : "Continue anyway"} strMiddleButtonText={rm.length ? "Keep and continue" : undefined} strCancelButtonText="Cancel"
        onOK={() => rm.length ? run(async () => { const r = await removeConflicts(rm.map((c) => c.id)); next(); return r; }) : next()}
        onMiddleButton={rm.length ? next : undefined} />);
    }).catch(next);
  };
  const confirmInstall = (title: string, go: () => Promise<Result>, detachGo?: () => Promise<Result>) =>
    withConflictCheck(() => confirmInstallNow(title, go, detachGo));
  const confirmInstallNow = (title: string, go: () => Promise<Result>, detachGo?: () => Promise<Result>) => {
    const needAccept = !!(su?.untested && !su.accepted_untested);
    if (detachGo && up?.needs_detach && !needAccept) {   // SteamOS with the eGPU in use: the update cannot be written until it is detached
      showModal(<ConfirmModal strTitle={`${title}: the eGPU is in use`} strOKButtonText="Detach and update" bDestructiveWarning
        strDescription={"The eGPU is detached first: Game Mode moves to the handheld screen and the monitor loses signal. Leave the cable plugged in. Then the update installs" + (su?.slow_build ? " (a driver rebuild can take 10-20 minutes; keep the charger connected)" : "") + ". When it is done the eGPU is attached again by itself and Game Mode returns to its screen. A notification tells you each step."}
        onOK={() => run(detachGo)} />);
      return;
    }
    const time = ` Expected time: ${su?.expect ?? "several minutes"}.` + (su?.slow_build ? " The driver is built on /home; the system partition is not touched. Keep the charger connected and the eGPU unplugged." : "") + " You can close the menu meanwhile; a notification appears when it is done.";
    const disclaimer = needAccept ? `NOT TESTED ON THIS HARDWARE: ${su!.untested!.split("\n").join("; ")}. This project was verified on Legion Go 1 and 2 and the ROG Xbox Ally X, with RTX 30 / 50 and RX 6800 XT / RX 9070 XT eGPUs, on CachyOS, SteamOS and Bazzite (TESTED.md). Here it may not work, may leave the screen dark, or may need a reboot to recover. You install and test it at your own risk.\n\n` : "";
    showModal(<ConfirmModal strTitle={needAccept ? `${title} (untested hardware)` : title} strDescription={disclaimer + WHAT + time} strOKButtonText={needAccept ? "I accept the risk" : "Continue"}
      onOK={() => run(async () => { if (needAccept) await acceptUntested(); return go(); })} />);
  };
  // setup state comes from the SYSTEM, not from the last run: it is the same after closing the menu, a Decky restart or a reboot
  const driverMissing = !!(su?.slow_build && su.installed_version && su.helpers_present && su.driver_ready === false && !su.driver_building);
  const behind = !!(su?.installed_version && vt(su.installed_version) < vt(su.payload_version));
  const needsInstall = !!(su && !su.unsupported && (!su.helpers_present || !su.installed_version || behind || (!!su.cmdline_missing && !su.cmdline_pending) || driverMissing));
  // offered whenever a newer release exists and setup is complete, including half way through an earlier update (plugin
  // newer than its system files): hiding it there left users with no way forward
  const updateReady = !!(up?.available && vt(up.available) > vt(PLUGIN_VERSION) && (!needsInstall || (behind && !!su?.helpers_present)));
  // First install: which eGPU decides whether the NVIDIA driver is built. A connected eGPU answers it; otherwise ask.
  // Later installs and updates keep the choice made (install.sh remembers it).
  const installFor = (v: "nvidia" | "amd") => confirmInstall(v === "amd" ? "Install for an AMD / Intel eGPU" : "Install for an NVIDIA eGPU", () => installSystem(false, v));
  const installClick = () => {
    if (su?.installed_version) { confirmInstall("Update the system files", () => installSystem(false), () => updateDetached("")); return; }
    // NV GPU Buddy (experimental): only on a machine egpu-detect sees as a desktop / laptop with a BUILT-IN NVIDIA card, or a
    // desktop with no card yet - never a handheld. Two confirmations; the default way out is the normal eGPU install.
    const m = su?.machine ?? "";
    if (/^(nv-desktop|nv-laptop|pc-no-nv)/.test(m)) {
      const card = m === "pc-no-nv";
      const what = m.startsWith("nv-laptop") ? "a laptop with a built-in NVIDIA card" : card ? "a desktop PC with no NVIDIA card yet" : "a desktop PC with a built-in NVIDIA card";
      showModal(<ConfirmModal strTitle={`This looks like ${what}`}
        strDescription={`EGPU Buddy has an experimental mode for it, NV GPU Buddy: NVIDIA settings, power and clocks, the Big Art menu fix, screens and keep awake, with no eGPU features. It installs EGPU Buddy's patched NVIDIA driver in place of the system's.${card ? " The driver is installed now, so the card works from its first boot: shut down, fit it, start up." : ""} Not tested on desktop PCs or laptops yet.`}
        strOKButtonText="NV GPU Buddy (experimental)" strMiddleButtonText="Normal eGPU install" strCancelButtonText="Cancel"
        onMiddleButton={() => installFor("nvidia")}
        onOK={() => setTimeout(() => showModal(<ConfirmModal strTitle="Confirm: not a handheld" bDestructiveWarning
          strDescription="NV GPU Buddy is for desktop PCs and laptops. A handheld with an eGPU needs the normal eGPU install. Is this a desktop PC or a laptop?"
          strOKButtonText="Yes, install NV GPU Buddy" strCancelButtonText="No"
          onOK={() => confirmInstall("Install NV GPU Buddy", () => installSystem(false, card ? "nv-gpu-buddy-card" : "nv-gpu-buddy"))} />), 300)} />);
      return;
    }
    // first install: always ask (an eGPU that happens to be plugged in is only mentioned, never decides on its own)
    const bus = su?.egpu_on_bus;
    const seen = bus === "nvidia" ? " An NVIDIA eGPU is connected right now." : (bus === "amd" || bus === "intel") ? ` An ${bus === "amd" ? "AMD" : "Intel"} eGPU is connected right now.` : "";
    showModal(<ConfirmModal strTitle="Which GPU type will you use?"
      strDescription={`NVIDIA: builds the NVIDIA driver (several minutes). AMD / Intel: no driver build (beta).${seen} The eGPU does not need to be plugged in. You can switch later in Setup & updates.`}
      strOKButtonText="NVIDIA" strMiddleButtonText="AMD / Intel (beta)" strCancelButtonText="Cancel"
      onOK={() => installFor("nvidia")} onMiddleButton={() => installFor("amd")} />);
  };
  // An AMD or Intel eGPU needs neither the patched nvidia-open build (the long part of an install)
  // nor the GBM-scanout gamescope (that exists only to fix the NVIDIA scan-out corruption).
  // Everything else - hot-plug attach, safe detach, cable-pull recovery, the session fallback,
  // audio follow - is vendor-neutral and is still installed.

  return (
    <>
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => setTab(tab === "main" ? "details" : "main")}>{tab === "main" ? "Show details" : "Back to main"}</ButtonItem>
        </PanelSectionRow>
        {tab !== "setup" && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => setTab("setup")}>Setup &amp; updates</ButtonItem>
          </PanelSectionRow>
        )}
        {/* NVIDIA settings one press from the front page (every NVIDIA install, both app variants) */}
        {tab !== "amd" && su?.installed_version && su.installed_vendor === "amd" && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => { setAmdEdit(null); setTab("amd"); }}>Adrenaline Settings</ButtonItem>
          </PanelSectionRow>
        )}
        {tab !== "nvidia" && su?.installed_version && su.installed_vendor !== "amd" && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => { setNvEdit(null); setTab("nvidia"); }}>NVIDIA settings</ButtonItem>
          </PanelSectionRow>
        )}
        {tab === "main" && !!trm?.routes.length && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => setTab("tv")}>TV controls</ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>
      {tab === "main" && (
        <PanelSection title={nvb ? "GPU" : "eGPU"}>
          <PanelSectionRow><div className={staticClasses.Text}>{s ? (nvb ? `${gpuName(tel["name"]) || "NVIDIA GPU"} · ${s.driver_loaded ? `driver ${tel["driver_version"] ?? ""}` : "driver not loaded"}${s.game_mode ? "" : " · Desktop"}` : stateLine(s)) : "Loading…"}</div></PanelSectionRow>
          {su?.unsupported && <PanelSectionRow><div style={{ fontSize: "12px", color: "#ff6b6b" }}>{su.unsupported}</div></PanelSectionRow>}
          {su?.driver_building && !su.busy && (
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{su.driver_building.includes("prebuild") ? "A SteamOS update is ready: EGPU Buddy is preparing the eGPU driver for it. Restart once it says it is done." : "SteamOS changed the kernel: EGPU Buddy is building the eGPU driver for it in the background (a few minutes). The eGPU works again by itself when it is done; nothing to install."}</div></PanelSectionRow>
          )}
          {needsInstall && su && !su.busy && su.rc !== 0 && (
            <>
              <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{su.installed_version && !su.helpers_present ? "System files are missing (OS update)." : behind ? `Plugin ${su.payload_version} is in; its system files finish installing by themselves (after any running game is closed), or press Update system integration.` : driverMissing ? "The NVIDIA driver is not installed. Keep the eGPU unplugged." : su.installed_version ? "Setup is incomplete." : "Not installed yet. Install asks which GPU type you use: NVIDIA, or AMD / Intel (beta)."}</div></PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => installClick()}>{behind && su.helpers_present ? "Update system integration" : su.installed_version ? "Repair system integration" : "Install system integration"}</ButtonItem></PanelSectionRow>
            </>
          )}
          {updateReady && !su?.busy && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Version {up!.available} is available.</div></PanelSectionRow>}
          {updateReady && !su?.busy && <ReleaseNotes label={`What's new in ${up!.available}`} />}
          {updateReady && !su?.busy && <PanelSectionRow><ButtonItem layout="below" disabled={busy || gameUp} onClick={() => up?.needs_detach ? confirmInstall(`Update to ${up!.available}`, () => updateInPlace(up!.available), () => updateDetached(up!.available)) : run(() => updateInPlace(up!.available))}>Update to {up!.available}</ButtonItem></PanelSectionRow>}
          {up?.state && <PanelSectionRow><div style={{ fontSize: "12px", color: up.state.includes("failed") ? "#ff6b6b" : undefined, opacity: up.state.includes("failed") ? 1 : 0.8 }}>{up.state}</div></PanelSectionRow>}
          {su?.busy && <PanelSectionRow><Progress pct={su.progress} title={(su.step.startsWith("update") || up?.state.startsWith("installing")) ? "Updating" : "Installing"} step={su.step} started={su.started} expect={su.expect} /></PanelSectionRow>}
          {su && !su.busy && su.rc === 0 && (
            <>
              {su.needs_reboot ? (
                <>
                  <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>
                    {su.egpu_on_bus
                      ? "Installed. One reboot activates the kernel parameters \u2014 the eGPU can stay plugged in."
                      : "Installed. One reboot activates the kernel parameters. DO NOT CONNECT THE eGPU UNTIL AFTER THAT REBOOT \u2014 the protections that stop a cable event resetting the machine are kernel parameters, and they are not active yet."}
                  </div></PanelSectionRow>
                  <PanelSectionRow><ButtonItem layout="below" onClick={() => run(rebootSystem)}>Reboot the system</ButtonItem></PanelSectionRow>
                </>
              ) : (
                <>
                  {su.gm_restart ? (<>
                    <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Installed. A few changed files are only read when Game Mode starts: they apply at the next start, or restart it now.</div></PanelSectionRow>
                    <PanelSectionRow><ButtonItem layout="below" disabled={busy || gameUp} onClick={() => run(restartGamemode)}>Restart Game Mode now</ButtonItem></PanelSectionRow>
                  </>) : <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Installed. Nothing else to do.</div></PanelSectionRow>}
                </>
              )}
            </>
          )}
          {su && !su.busy && su.cmdline_pending && su.rc !== 0 && (
            <>
              <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Reboot to activate the kernel parameters (eGPU unplugged).</div></PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy || gameUp} onClick={() => run(rebootSystem)}>Reboot the system</ButtonItem></PanelSectionRow>
            </>
          )}
          {su && !su.busy && su.rc !== null && su.rc !== 0 && <PanelSectionRow><div style={{ fontSize: "12px", color: "#ff6b6b" }}>{su.rc === 21 ? (nvb ? "The NVIDIA card is in use, so the update is staged: it installs by itself at the next reboot." : "Nothing was changed: the eGPU driver is in use. Safe Detach, unplug the eGPU, then try again.") : su.rc === 20 ? "Everything is installed except the NVIDIA driver, which could not be built. Keep the eGPU unplugged, check the internet connection and press Repair. Details: Show setup & updates." : `Install failed (rc ${su.rc}). Log: /tmp/egpu-buddy-setup.log`}</div></PanelSectionRow>}
          {!nvb && !!s?.resets?.count && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>This device was reset by its hardware {s.resets.count === 1 ? "once" : `${s.resets.count} times`} while the eGPU was connected (last: {s.resets.last}). Always use Safe Detach before unplugging.</div></PanelSectionRow>}
          {s && !s.game_mode && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>In Desktop mode use the {appName()} desktop app.</div></PanelSectionRow>}
          {!nvb && gameUp && s?.game_mode && <PanelSectionRow><div style={{ fontSize: "12px", color: "#f0b429" }}>A game is running. Exit it first to switch screens, attach or detach the eGPU: each of these restarts Game Mode.</div></PanelSectionRow>}
          {!nvb && <>
          {s?.attach_pending && <PanelSectionRow><div style={{ fontSize: "12px" }}>eGPU plugged in. Close the game, then press Attach.</div></PanelSectionRow>}
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !s?.game_mode || gameUp || (s?.present && (s?.on_egpu || s?.egpu_handheld))} onClick={() => showModal(<ConfirmModal strTitle="Attach the eGPU" strDescription="Game Mode restarts on the eGPU display: the screen goes dark for a few seconds. When it is back, reopen this menu to see the result." strOKButtonText="Attach" onOK={() => run(() => attach(false))} />)}>Attach eGPU</ButtonItem>
          </PanelSectionRow>
          {s?.game_mode && (s.on_egpu || s.egpu_handheld) && screenTargets(s, tvWakes).filter((t) => t.name !== s.output).map((t) => (
            <PanelSectionRow key={t.name}><ButtonItem layout="below" disabled={busy || gameUp}
              onClick={() => showModal(<ConfirmModal strTitle={`Show Game Mode on ${t.label}`} strDescription={`${t.detail}\n\nGame Mode restarts on that screen (the current one goes dark for a few seconds). Switch back the same way.`}
                strOKButtonText="Switch" onOK={() => run(() => setGameScreen(t.name))} />)}>
                {/* picture above the text: beside it, the text was squeezed into a narrow column */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}><span style={{ flex: "0 0 auto" }}>{(t as any).photo ? <Pic {...(t as any).photo} width={96} minH={40} /> : <span dangerouslySetInnerHTML={{ __html: t.icon }} />}</span>
                  {/* the handheld: bigger outline, its exact model under it, smaller text */}
                  {t.name === "eDP-1" && HH_NAME && <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "-4px" }}>{HH_NAME}</div>}
                  <div style={{ textAlign: "center", fontSize: t.name === "eDP-1" ? "12px" : undefined }}>Show Game Mode on {t.label}{t.xr && <span style={{ fontSize: "10px", background: "#1a9fff", borderRadius: "2px", padding: "0 4px", marginLeft: "6px" }}>XR</span>}
                    <div style={{ fontSize: "11px", opacity: 0.7 }}>{t.detail}</div></div></div></ButtonItem></PanelSectionRow>
          ))}
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !s?.game_mode || !s?.present || gameUp} onClick={() => showModal(<ConfirmModal strTitle="Safe Detach" strDescription="Game Mode moves to the handheld screen and the eGPU is removed from the bus: the screen goes dark for a few seconds and the monitor loses signal. Do not unplug yet. When the handheld screen is back, reopen this menu: it says when it is safe to unplug the cable." strOKButtonText="Detach" bDestructiveWarning onOK={() => run(safeDetach)} />)}>Safe Detach</ButtonItem>
          </PanelSectionRow>
          {s?.gm_status?.state && s.gm_status.state !== "ATTACHED" && s.gm_status.state !== "IDLE" && <PanelSectionRow><div style={{ fontSize: "13px", fontWeight: 600, color: s.gm_status.state === "SAFE_COMPLETE" || s.gm_status.state === "DETACHED" ? "#4caf50" : s.gm_status.state.includes("DO_NOT") || s.gm_status.state === "FAILED" ? "#ff6b6b" : "#f0b429" }}>{s.gm_status.state === "SAFE_COMPLETE" || s.gm_status.state === "DETACHED" ? "Safe to unplug the cable." : s.gm_status.message}</div></PanelSectionRow>}
          </>}
          {tr?.message && (tr.running || tr.state === "reverted" || tr.state === "failed") && <PanelSectionRow><div style={{ fontSize: "12px", color: tr.state === "failed" ? "#ff6b6b" : "#f0b429" }}>NVIDIA driver: {tr.message}</div></PanelSectionRow>}
          {msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
          {/* Install and uninstall run as background jobs. Without their progress and result HERE, the
              main page said "uninstall started" and never changed, and the only way to learn whether it
              had finished or failed was to go digging two pages deep. */}
          {su?.step && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>{su.step}</div></PanelSectionRow>}
          {su?.busy === false && su?.rc === 0 && !su?.installed_version &&
            <PanelSectionRow><div style={{ fontSize: "12px", color: "#4caf50" }}>Uninstalled. The machine is back to how it was.</div></PanelSectionRow>}
          <PanelSectionRow><ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => run(() => checkUpdate(false))}>Check for updates</ButtonItem></PanelSectionRow>
          {su?.installed_version && (
            <>
              <PanelSectionRow>
                <ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={askUninstall}>Uninstall</ButtonItem>
              </PanelSectionRow>
            </>
          )}
          <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.7 }}>{appName()} {PLUGIN_VERSION}{nvb ? " (experimental)" : ""}{su && !su.installed_version ? " · not installed" : ""} · {up ? (up.available ? `update ${up.available} available` : up.checked ? "up to date" : "update check pending") : "…"}{up?.auto_update ? " · auto-update on" : " · auto-update off"}</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "details" && !s && (
        <PanelSection title={nvb ? "GPU details" : "eGPU details"}>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>No eGPU connected. Setup, updates and uninstall are still available above.</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "details" && s && (
        <>
          <PanelSection title={nvb ? "GPU details" : "eGPU details"}>
            {!s.present ? (
              <>
                <PanelSectionRow><div className={staticClasses.Text}>{nvb ? "No NVIDIA card found (the driver is ready for one)." : "eGPU not connected."}</div></PanelSectionRow>
                <Row k="Session" v={s.game_mode ? "Game Mode on handheld" : "Desktop"} />
              </>
            ) : (
            <>
              {/* the dock on its own row: "ASUS ROG XG Mobile · RTX 5070 Ti Laptop GPU" on one row was cut off on the panel */}
              {s.dock && <Row k="Dock" v={s.dock} />}
              <Row k="GPU" v={gpuName(tel["name"]) || (s.present ? s.bdf : "absent")} />
              <Row k="Driver" v={s.driver_loaded ? `nvidia ${tel["driver_version"] ?? ""}` : "not loaded"} />
              <Row k="PCIe" v={s.present ? `${s.link.speed} x${s.link.width}` : ""} />
              {!nvb && ad?.usb4 && usb4.total !== undefined && (
                <PanelSectionRow><div style={{ padding: "6px 8px", borderRadius: "4px", fontSize: "12px",
                  background: usb4.slow ? "#3a2a14" : "#1a3a57", border: `1px solid ${usb4.slow ? "#e3a33b" : "#1a9fff"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600 }}>USB4 link</span><b>{usb4.total} Gb/s · {usb4.lanes} × {usb4.per_lane}</b></div>
                  <div style={{ opacity: 0.85, marginTop: "2px" }}>{usb4.slow ? (usb4.lanes! < 2 ? "1 lane: check the cable or port" : "slow link: check the cable or port") : usb4.name}</div>
                </div></PanelSectionRow>
              )}
              <Row k="Session" v={nvb ? (s.game_mode ? "Game Mode" : "Desktop") : s.game_mode ? (s.on_egpu ? `Game Mode on ${screenName(s)}` : s.egpu_handheld ? `${s.output.startsWith("eDP") ? "Handheld" : screenName(s)} + eGPU` : "Game Mode on panel") : "Desktop"} />
              {/* one row per screen: a joined list got cut off on the panel */}
              {(scr?.length ? scr : s.displays.map((d) => ({ connector: d.name, name: d.model, state: d.enabled ? "" : "off" }))).map((x) => (
                <Row key={x.connector} k={x.name || x.connector}
                  v={[screenState[x.state], x.connector.startsWith("HDMI") ? "HDMI" : x.connector.startsWith("DP") ? "DisplayPort" : x.connector].filter(Boolean).join(" · ")} />
              ))}
              {scr?.some((x) => x.ddc) && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await wakeScreens(); getScreens().then(setScr).catch(() => {}); return r; })}>Wake screens</ButtonItem></PanelSectionRow>}
              <Row k="Audio" v={nvb ? audioName(s.audio_sink, s.bdf).replace(/^eGPU/, "GPU") : audioName(s.audio_sink, s.bdf)} />
              <Row k="Temp" v={tel["temperature.gpu"] ? `${tel["temperature.gpu"]} °C` : ""} />
              <Row k="Power" v={tel["power.draw"] ? (Number.isFinite(Number(tel["power.limit"])) ? `${Math.round(Number(tel["power.draw"]))} / ${Math.round(Number(tel["power.limit"]))} W` : xgLive.target ? `${Math.round(Number(tel["power.draw"]))} / ${xgLive.target} W target` : xgCap !== null ? `${Math.round(Number(tel["power.draw"]))} / ${xgCap} W cap` : `${Math.round(Number(tel["power.draw"]))} W`) : ""} />
              <Row k="Core / mem" v={tel["clocks.gr"] ? `${tel["clocks.gr"]} / ${tel["clocks.mem"]} MHz` : ""} />
              <Row k="VRAM" v={tel["memory.used"] ? `${tel["memory.used"]} / ${tel["memory.total"]} MiB` : ""} />
              <Row k="Load" v={tel["utilization.gpu"] ? `${tel["utilization.gpu"]} %` : ""} />
              <Row k="Fan" v={tel["fan.speed"] && Number.isFinite(Number(tel["fan.speed"])) ? `${tel["fan.speed"]} %` : (tel["name"] && s.dock ? (xg ? `${s.xgm?.fan ?? "auto"} mode (set in the XG Mobile; its speed is not readable)` : "run by the dock (not readable on Linux)") : "")} />
            </>
            )}
          </PanelSection>
          {(
            <PanelSection title="Support report">
              <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={async () => { setReport(null); try { setReport(await makeReport()); } catch { setMsg("Could not make the report."); } }}>Save support report to Desktop</ButtonItem></PanelSectionRow>
              {report && (<>
                <PanelSectionRow><div style={{ fontSize: "12px" }}>Scan with your phone to open a new GitHub issue with the report summary filled in. The full report is saved as <b>{report.file}</b>: attach it to the issue.</div></PanelSectionRow>
                <PanelSectionRow><div style={{ width: "240px", margin: "0 auto", background: "#fff", borderRadius: "4px" }} dangerouslySetInnerHTML={{ __html: qrSvg(report.url) }} /></PanelSectionRow>
                <Row k="Code" v={report.code} />
              </>)}
              <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.75 }}>{nvb ? "One file with everything NV GPU Buddy logs (versions, GPU, screens, Game Mode, NVIDIA settings and the system log), saved in the Desktop folder. Also in Desktop Mode: the \"Save NV GPU Buddy report\" icon." : "One file with everything EGPU Buddy logs (versions, GPU and link, screens, Game Mode, attach, Safe Detach, driver trial and the system log), saved in the Desktop folder. Also in Desktop Mode: the \"Save EGPU Buddy report\" icon."} No serial numbers, Wi-Fi names, IP addresses or user names.</div></PanelSectionRow>
            </PanelSection>
          )}
          {s.present && xg && s.driver_loaded && (
            <PanelSection title="XG Mobile">
              {intro && (<PanelSectionRow><img src={intro.src} onClick={endIntro}
                style={{ width: "100%", display: "block", borderRadius: "4px", transition: "opacity 0.6s", opacity: intro.fading ? 0 : 1 }} /></PanelSectionRow>)}
              {!plOk && (<>
              <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>NVIDIA does not let the driver set this GPU's power limit (its cap is {xgTop} W). A power target below it makes EGPU Buddy hold the GPU there by limiting its clock{xgLive.target && xgLive.cap ? ` (now ${xgLive.cap} MHz)` : ""}.</div></PanelSectionRow>
              <PanelSectionRow>
                <SliderField label={ptNow >= xgTop ? "Power target: none" : "Power target (W)"} value={ptNow} min={40} max={xgTop} step={5} showValue onChange={setPt} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={lock || (!keepFocus && pt === null)} onClick={() => { if (keepFocus && pt === null) return; const w = ptNow >= xgTop ? 0 : ptNow; setPt(null); run(() => xgmPower(w)); }}>Apply power target</ButtonItem></PanelSectionRow>
              </>)}
              <PanelSectionRow>
                <DropdownItem label="Fan mode" selectedOption={s.xgm?.fan ?? "auto"} disabled={lock}
                  rgOptions={[["auto", "Auto (the XG Mobile's own)"], ["quiet", "Quiet"], ["balanced", "Balanced"], ["performance", "Performance"], ["max", "Max"],
                    ...(s.xgm?.curve ? [["custom", "Custom (made in the desktop app)"]] : [])].map(([data, label]) => ({ data, label }))}
                  onChange={(o) => run(() => xgmFan(String(o.data)))} />
              </PanelSectionRow>
              <PanelSectionRow><ToggleField label="Lights" checked={lightOn} disabled={lock} onChange={(v) => run(() => xgmLight(v))} /></PanelSectionRow>
              {lightOn && (<>
              <PanelSectionRow>
                <DropdownItem label="Light effect" selectedOption={s.xgm?.effect ?? "static"} disabled={lock}
                  rgOptions={[["static", "Static"], ["breathe", "Breathe"], ["cycle", "Color cycle"], ["rainbow", "Rainbow"], ["strobe", "Strobe"]].map(([data, label]) => ({ data, label }))}
                  onChange={(o) => lightFx(String(o.data))} />
              </PanelSectionRow>
              <PanelSectionRow>
                <DropdownItem label="Light color" selectedOption={s.xgm?.color ?? "ff0000"} disabled={lock}
                  rgOptions={XGM_COLORS.map(([data, label]) => ({ data, label }))} onChange={(o) => lightFx("", String(o.data))} />
              </PanelSectionRow>
              <PanelSectionRow>
                <DropdownItem label="Light speed" selectedOption={s.xgm?.speed ?? "normal"} disabled={lock}
                  rgOptions={[["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]].map(([data, label]) => ({ data, label }))} onChange={(o) => lightFx("", "", String(o.data))} />
              </PanelSectionRow>
              <PanelSectionRow>
                <SliderField label="Light brightness" value={s.xgm?.brightness ?? 3} min={0} max={3} step={1} notchCount={4} notchTicksVisible showValue disabled={lock}
                  onChange={(v) => run(() => xgmSet("brightness", String(v)))} />
              </PanelSectionRow>
              </>)}
              <PanelSectionRow>
                <SliderField label="Core clock offset (MHz)" value={xoffNow[0]} min={-300} max={300} step={15} showValue onChange={(v) => setXoff([v, xoffNow[1]])} />
              </PanelSectionRow>
              <PanelSectionRow>
                <SliderField label="Memory clock offset (MHz)" value={xoffNow[1]} min={-1000} max={1500} step={50} showValue onChange={(v) => setXoff([xoffNow[0], v])} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={lock || (!keepFocus && xoff === null)} onClick={() => { if (keepFocus && xoff === null) return; const [c, m] = xoffNow; setXoff(null); run(() => xgmSet("offset", `${c}:${m}`)); }}>Apply clock offsets</ButtonItem></PanelSectionRow>
              {!controlsOk && msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
            </PanelSection>
          )}
          {!s.present ? null : controlsOk ? (
            <PanelSection title="Power controls">
              {plOk ? (<>
              <PanelSectionRow>
                <SliderField label="Power limit (W)" value={plNow} min={plMin} max={plMax} step={5} showValue onChange={setPl} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={lock || (!keepFocus && pl === null)} onClick={() => (keepFocus && pl === null) ? undefined : run(() => setPowerLimit(plNow))}>Apply power limit</ButtonItem></PanelSectionRow>
              </>) : (
              <>
              {!xg && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>This GPU does not take a power limit from the driver (a laptop-class GPU, as in an ASUS XG Mobile): the dock sets its power{xgCap !== null ? ` (cap now ${xgCap} W${Number.isFinite(plMax) ? `, at most ${Math.round(plMax)} W` : ""})` : ""}. Limit its clock instead to lower power and heat.</div></PanelSectionRow>}
              {!xg && clkMax > 0 && (<>
              <PanelSectionRow>
                <SliderField label="Max GPU clock (MHz)" value={clkNow} min={clkMin} max={clkMax} step={15} showValue onChange={setClk} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={lock || (!keepFocus && clk === null)} onClick={() => (keepFocus && clk === null) ? undefined : run(() => setClockLimit(clkNow))}>Apply clock limit</ButtonItem></PanelSectionRow>
              </>)}
              </>
              )}
              {!xg && (<>
              <PanelSectionRow>
                <SliderField label="Core clock offset (MHz)" value={off} min={-300} max={300} step={15} showValue onChange={setOff} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => setCoreOffset(off))}>Apply offset</ButtonItem></PanelSectionRow>
              </>)}
              <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => { setOff(0); setPl(null); setClk(null); setPt(null); setXoff(null); run(resetClocks); }}>Reset clocks</ButtonItem></PanelSectionRow>
              {msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
            </PanelSection>
          ) : (
            <PanelSection title="Power controls"><PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{nvb ? "Available when the NVIDIA driver is loaded." : "Available when Game Mode runs on the eGPU. On the handheld GPU, Game Mode's own performance menu applies."}</div></PanelSectionRow></PanelSection>
          )}
        </>
      )}
      {tab === "setup" && (
        <PanelSection title="System integration">
          <PanelSectionRow><div style={{ fontSize: "12px" }}>
            {su ? (su.installed_version ? (behind ? "Installed — press Install to finish updating" : "Installed") : "Not installed") : "…"}
          </div></PanelSectionRow>
          {su?.untested && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Hardware: {su.untested.split("\n").join("; ")}. {su.accepted_untested ? "Risk notice accepted." : "Risk notice not accepted yet."}</div></PanelSectionRow>}
          {su?.cmdline_missing && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Kernel parameters not active: {su.cmdline_missing}</div></PanelSectionRow>}
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Reinstalls everything the first run installs. Safe to run again.</div></PanelSectionRow>
          {su?.busy && <PanelSectionRow><Progress pct={su.progress} title="Installing" step={su.step} started={su.started} expect={su.expect} /></PanelSectionRow>}
          {su && !su.busy && su.rc !== null && <PanelSectionRow><div style={{ fontSize: "12px", color: su.rc === 0 ? "#4caf50" : "#ff6b6b" }}>{su.rc === 0 ? "Finished." : `Failed (rc ${su.rc}).`}</div></PanelSectionRow>}

          {nvb ? (<>
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>NV GPU Buddy (experimental): EGPU Buddy for a built-in NVIDIA card. eGPU features are not part of this mode, and it only takes the updates marked for it.</div></PanelSectionRow>
            <PanelSectionRow><ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => confirmInstall("Reinstall / update NV GPU Buddy", () => installSystem(false))}>Reinstall / update system integration</ButtonItem></PanelSectionRow>
          </>) : (<>
          {/* The choice is made UP FRONT, not detected. The point of this app is that it is set up in
              advance so the eGPU mounts by itself when it is finally connected - so on a machine that
              has never been set up there is usually nothing plugged in to detect, and asking is the only
              honest thing to do. Detection is used afterwards only to catch a wrong answer. */}
          {!su?.installed_version && (
            <PanelSectionRow>
              <div style={{ fontSize: "12px", opacity: 0.9 }}>
                <b>Which eGPU will you connect?</b> Pick one now - it only decides whether the NVIDIA driver is
                built. The eGPU does not need to be plugged in, and you can run the other install later if you
                change cards.
              </div>
            </PanelSectionRow>
          )}

          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => su?.installed_version && su.installed_vendor !== "amd" ? confirmInstall("Reinstall / update", () => installSystem(false)) : installFor("nvidia")}>
              {su?.installed_version ? (su.installed_vendor === "amd" ? "Switch to the NVIDIA install (builds the driver)" : "Reinstall / update system integration") : "NVIDIA eGPU - install (builds the driver)"}
            </ButtonItem>
          </PanelSectionRow>
          {!su?.installed_version && (
            <PanelSectionRow>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>
                Builds the patched NVIDIA driver and the gamescope scan-out fix. Takes several minutes.
              </div>
            </PanelSectionRow>
          )}

          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => installFor("amd")}>
              {su?.installed_version ? (su.installed_vendor === "amd" ? "Reinstall / update (AMD / Intel, beta)" : "Switch to the AMD / Intel install (beta; removes the NVIDIA driver)") : "AMD / Intel eGPU (beta) - install (no driver build)"}
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <div style={{ fontSize: "11px", opacity: 0.7 }}>
              Skips the NVIDIA driver build and the NVIDIA-only gamescope fix. Keeps hot-plug, safe detach,
              cable-pull recovery, audio follow and the flood protections. Beta: not yet tested on real AMD or
              Intel hardware.
            </div>
          </PanelSectionRow>

          {su?.installed_version && su.installed_vendor === "amd" && su.egpu_on_bus === "nvidia" && (
            <PanelSectionRow>
              <div style={{ fontSize: "12px", color: "#ffb300" }}>
                An NVIDIA eGPU is connected, but this machine was set up with the AMD install, which skips the
                NVIDIA driver. Run the NVIDIA install above to add it.
              </div>
            </PanelSectionRow>
          )}
          {su?.installed_version && su.installed_vendor !== "amd" && (su.egpu_on_bus === "amd" || su.egpu_on_bus === "intel") && (
            <PanelSectionRow>
              <div style={{ fontSize: "12px", color: "#ffb300" }}>
                A non-NVIDIA eGPU is connected. The NVIDIA driver this install built is not used by it - the
                AMD / Intel install above suits this machine better.
              </div>
            </PanelSectionRow>
          )}
          </>)}
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !!su?.busy || !su?.installed_version} onClick={askUninstall}>Uninstall system integration</ButtonItem>
          </PanelSectionRow>
          {su?.log && <PanelSectionRow><ButtonItem layout="below" onClick={() => setLogOpen(logOpen === "setup" ? "" : "setup")}>{logOpen === "setup" ? "Hide install log" : "Show install log"}</ButtonItem></PanelSectionRow>}
          {su?.log && logOpen === "setup" && <PanelSectionRow><div style={{ fontSize: "10px", whiteSpace: "pre-wrap", opacity: 0.8 }}>{su.log}</div></PanelSectionRow>}
        </PanelSection>
      )}
      {tab === "setup" && tr?.available && (
        <PanelSection title="NVIDIA driver">
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>
            Main driver: {tr.main}. Beta: {tr.beta || "none"} (for testers, tried from {tr.main}). Previous: {tr.old}. Running now: {tr.installed || "not installed"}.
          </div></PanelSectionRow>
          {tr.message && <PanelSectionRow><div style={{ fontSize: "12px", color: tr.state === "failed" ? "#ff6b6b" : tr.state === "kept" ? "#4caf50" : "#f0b429" }}>{tr.message}</div></PanelSectionRow>}
          {tr.current === "old" && (
            <PanelSectionRow><ButtonItem layout="below" disabled={busy || tr.running || !!su?.busy || gameUp || !s?.game_mode}
              onClick={() => showModal(<ConfirmModal strTitle={`Switch to driver ${tr.main}`}
                strDescription={`The eGPU is safely detached, the NVIDIA driver ${tr.main} is downloaded from NVIDIA (about 530 MB) and built on this device (10-20 minutes, about 6 GB free space needed while building), then the eGPU is attached with it and checked. If it does not come up, the previous driver ${tr.old} is put back and attached again by itself. If the machine resets or hangs during the switch, it is put back at the next boot, before the eGPU is used. Keep the charger and the eGPU connected. Everything is logged to /var/log/egpu-driver-trial.log.`}
                strOKButtonText="Switch now" bDestructiveWarning onOK={() => run(startTrial)} />)}>Switch to driver {tr.main}</ButtonItem></PanelSectionRow>
          )}
          {tr.current === "main" && !!tr.beta && (
            <PanelSectionRow><ButtonItem layout="below" disabled={busy || tr.running || !!su?.busy || gameUp || !s?.game_mode}
              onClick={() => showModal(<ConfirmModal strTitle={`Try beta driver ${tr.beta}`}
                strDescription={`For testers. The eGPU is safely detached, the beta NVIDIA driver ${tr.beta} is downloaded from NVIDIA (about 550 MB) and built on this device (10-20 minutes, about 6 GB free space needed while building), then the eGPU is attached with it and checked. If it does not come up, the main driver ${tr.main} is put back and attached again by itself. If the machine resets or hangs during the test, ${tr.main} is put back at the next boot, before the eGPU is used. Keep the charger and the eGPU connected. Everything is logged to /var/log/egpu-driver-trial.log.`}
                strOKButtonText="Try the beta driver" bDestructiveWarning onOK={() => run(startBetaTrial)} />)}>Try beta driver {tr.beta}</ButtonItem></PanelSectionRow>
          )}
          {tr.current !== "old" && (
            <PanelSectionRow><ButtonItem layout="below" disabled={busy || tr.running || gameUp || !s?.game_mode}
              onClick={() => { const back = tr.current === "beta" ? tr.main : tr.old;
                showModal(<ConfirmModal strTitle={`Return to ${back}`} strDescription={`The eGPU is safely detached, the driver ${back} is put back (offline, a few minutes) and the eGPU is attached again.`}
                  strOKButtonText="Return" onOK={() => run(revertTrial)} />); }}>{tr.current === "beta" ? `Return to the main driver ${tr.main}` : `Return to the previous driver ${tr.old}`}</ButtonItem></PanelSectionRow>
          )}
          {tr.log && <PanelSectionRow><ButtonItem layout="below" onClick={() => setLogOpen(logOpen === "trial" ? "" : "trial")}>{logOpen === "trial" ? "Hide driver log" : "Show driver log"}</ButtonItem></PanelSectionRow>}
          {tr.log && logOpen === "trial" && <PanelSectionRow><div style={{ fontSize: "10px", whiteSpace: "pre-wrap", opacity: 0.8 }}>{tr.log}</div></PanelSectionRow>}
        </PanelSection>
      )}
      {tab === "setup" && !nvb && s?.present && s.game_mode && (
        <PanelSection title="Game screen">
          <PanelSectionRow><DropdownItem label="Play games on" disabled={busy || gameUp}
            selectedOption={s.output && s.output !== "*" ? s.output : "eDP-1"}
            rgOptions={screenTargets(s, tvWakes).map((t) => ({ data: t.name, label: t.name === "eDP-1" ? "Handheld screen (games on the eGPU)" : t.label }))}
            onChange={(o) => { if (o.data !== s.output) run(() => setGameScreen(o.data)); }} /></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{gameUp ? "Exit the game first: switching screens restarts Game Mode." : "Switching restarts Game Mode on the chosen screen (dark for a few seconds)."}</div></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>XR glasses passthrough: glasses plugged into the handheld's USB-C show your eGPU games, with no HDMI-to-USB-C adapter on the eGPU needed.</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && awake && (
        <PanelSection title="Sleep">
          <PanelSectionRow><ToggleField label="Keep awake" disabled={!awake.egpu && !awake.enabled} description={`Off by default. On: while the eGPU is plugged in, the machine never goes to sleep by itself (Steam's sleep timers are set to Never and put back when you switch it off). The Sleep button still works, and the screen can still dim. Without an eGPU it pauses and comes back with the eGPU.${awake.enabled && !awake.egpu ? " Paused: no eGPU plugged in." : ""}`}
            checked={awake.enabled} onChange={(v) => run(async () => { const r = await setKeepAwake(v); const a = await getKeepAwake(); setAwake(a);
              await (v ? steamSleep(0, 0) : steamSleep(a.prev[0], a.prev[1])); return r; })} /></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && gr && (
        <PanelSection title="Games">
          <PanelSectionRow><ToggleField label="Best resolution and refresh rate on every screen" description="On by default. Steam runs big external screens (XR glasses in ultrawide, 1440p, 4K) at 1920x1080 and starts games there with black bars. With this on, Game Mode uses each screen's highest resolution and refresh rate, follows the glasses into and out of ultrawide, and games start at the screen's size. Games you set yourself are left alone; switching this off leaves Steam's settings as they are." checked={gr.enabled} onChange={(v) => run(async () => { const r = await setGameRes(v); setGr(await getGameRes()); return r; })} /></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && sui?.available && (
        <PanelSection title="Steam menu">
          <PanelSectionRow><ToggleField label={nvb ? "Big Art mode menu fix (NVIDIA)" : "Big Art mode menu fix (NVIDIA eGPU)"} description={`Off by default. On ${nvb ? "an NVIDIA GPU" : "the NVIDIA eGPU"} Steam's interface compositor cannot start, so in Big Art mode the main menu slides in over a black bar. On: ${appName()} supplies what it is missing, on the NVIDIA GPU; no Steam file is changed. Applies when ${nvb ? "Steam restarts" : "Game Mode restarts"}.${sui.enabled && sui.route ? (sui.active ? " Active now." : " Not active yet: restart Game Mode.") : ""}`}
            checked={!!sui.enabled} onChange={(v) => run(async () => { const r = await setSteamUi(v); setSui(await getSteamUi()); if (r.ok && r.restart) { const g = await restartGamemode(); return { ok: true, message: `${r.message} ${g.message}` }; } return r; })} /></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && nv?.available && (
        <PanelSection title="NVIDIA settings (experimental)">
          <PanelSectionRow><ButtonItem layout="below" onClick={() => { setNvEdit(null); setTab("nvidia"); }}>Open NVIDIA settings</ButtonItem></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{nv.active ? "Some settings are changed from their defaults." : "All on their defaults: nothing is changed."}</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "nvidia" && nv?.available && (() => {
        const cur = nvEdit ?? nv.settings ?? {};
        // every pick saves at once: a pick waiting for Apply was lost when the menu closed
        const saveNv = (n: Record<string, string | number>) => { setNvEdit(n); run(async () => { const r = await setNvidia(n); if (r.ok) { setNv(await getNvidia()); setNvEdit(null);
          return { ok: true, message: "Saved: games get it at their next launch (a running game keeps its settings until restarted)." }; } return r; }); };
        return (<PanelSection title="NVIDIA settings (experimental)">
          <PanelSectionRow><ButtonItem layout="below" onClick={() => setTab("setup")}>Back to setup</ButtonItem></PanelSectionRow>
          {gs?.running && (() => { const st = Object.values(gs.settings ?? {}), on = st.filter((x) => x.state === "active").length, set = st.filter((x) => x.state !== "default").length;
            return <PanelSectionRow><div style={{ fontSize: "12px", padding: "6px 8px", borderRadius: "4px", background: "#1a3a57", border: "1px solid #1a9fff" }}>
              <b>Running: {gs.game}</b><div style={{ opacity: 0.85, marginTop: "2px" }}>{set ? `${on} of ${set} changed setting${set > 1 ? "s" : ""} active in this game.` : "Every setting is on its default."}</div></div></PanelSectionRow>; })()}
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{nvb ? "Global settings for every game Steam starts on the NVIDIA GPU; a setting on its default changes nothing." : "Global settings for every game that renders on the NVIDIA eGPU. Games on the handheld's own GPU never get them; a setting on its default changes nothing."}</div></PanelSectionRow>
          {NV_ROWS.map((r) => <PanelSectionRow key={r.key}><DropdownItem layout="below" label={r.label} description={r.key === "power" ? r.desc : `Next game launch. ${r.desc}`} disabled={lock}
            selectedOption={cur[r.key] ?? r.opts[0][0]} rgOptions={r.opts.map(([d, l]) => ({ data: d, label: l }))}
            onChange={(o) => { if (keepFocus) ui(`nvidia pick ${r.key} = ${o.data}`); saveNv({ ...cur, [r.key]: o.data }); }} />
            {gs?.running && <GameState st={gs.settings?.[r.key]} />}</PanelSectionRow>)}
          {cur.low_latency === "ultra" && pr && !pr.ready && <>
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>Ultra needs Proton 10, GE-Proton 10 or Proton Experimental (installed now: {pr.tools.map((t) => t.name).join(", ") || "none found"}). {pr.install?.message ?? ""}</div></PanelSectionRow>
            <PanelSectionRow><ButtonItem layout="below" disabled={lock || pr.install?.state === "running"} onClick={() => run(async () => { const r = await installProton(); setTimeout(async () => setPr(await getProton()), 3000); return r; })}>
              {pr.install?.state === "running" ? "Installing GE-Proton…" : "Install latest GE-Proton"}</ButtonItem></PanelSectionRow></>}
          {cur.low_latency === "ultra" && pr?.ready && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Ultra: pick {pr.tools.filter((t) => t.ok).map((t) => t.name).join(" or ")} for the game (Properties &gt; Compatibility), or for every game in Steam Settings &gt; Compatibility. {pr.install?.state === "done" ? pr.install.message : ""}</div></PanelSectionRow>}
          {(() => { const once = s?.game_mode && nv.loader !== "loaded" && !!nv.enabled;   // the loader is not in this Game Mode yet: one restart
            return once && <PanelSectionRow><ButtonItem layout="below" disabled={lock || gameUp} onClick={() => run(() => applyNvidia())}>
              {gameUp ? "Exit the game (one-time restart)" : nvb ? "Apply (one-time Steam restart)" : "Apply (one-time Game Mode restart)"}</ButtonItem></PanelSectionRow>; })()}
          {msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
          {gameUp && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>A game is running: it keeps its settings until you start it again. For an instant change use System settings (live) below.</div></PanelSectionRow>}
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{nv.loader === "loaded" ? "Changes apply the next time a game starts; no restart." : nvb ? "First time only: Steam restarts once so it starts with the settings loader. After that, changes apply at the next game launch." : "First time only: Game Mode restarts once so Steam starts with the settings loader. After that, changes apply at the next game launch."}</div></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => saveNv({ ...(nv.defaults ?? {}) })}>Restore defaults</ButtonItem></PanelSectionRow>
          {nv.enabled && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await nvidiaOff(); setNv(await getNvidia()); setNvEdit(null); return r; })}>Turn off completely</ButtonItem></PanelSectionRow>}
          {!!nv.games?.length && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{nv.games.length} game(s) ship their own dxvk.conf; it is read after these settings, so its options win: {nv.games.map((g) => g.game + (g.overridden.length ? ` (own ${g.overridden.join(", ")})` : "")).join(" · ")}</div></PanelSectionRow>}
          <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.65 }}>* Experimental. Done with what Linux offers: DXVK and vkd3d-proton (Proton games), the NVIDIA driver's own options and NVIDIA's clock control, handed to each game as it starts (Steam games and non-Steam games added to Steam). A game's own launch options and dxvk.conf always win; EGPU_NVT_OFF=1 as a launch option keeps one game out. Not yet: FXAA, texture filtering quality, page flipping.</div></PanelSectionRow>
        </PanelSection>);
      })()}
      {tab === "amd" && amd?.available && (() => {
        const cur = amdEdit ?? amd.settings ?? {};
        // every pick saves at once: a pick waiting for Apply was lost when the menu closed
        const saveAmd = (n: Record<string, string | number>) => { setAmdEdit(n); run(async () => { const r = await setAmd(n); if (r.ok) { setAmdEdit(null); setAmdS(await getAmd()); } return r; }); };
        const once = amd.game_mode && amd.loader !== "loaded" && !!amd.enabled;   // saved, but Steam started without the loader
        const c = amd.card ?? {};
        const caps = c.cap_min != null && c.cap_max != null && c.cap_max > c.cap_min
          ? Array.from(new Set([...Array.from({ length: 11 }, (_, i) => Math.round((c.cap_min! + (c.cap_max! - c.cap_min!) * i / 10) / 5) * 5), c.cap_default ?? c.cap_max!, c.cap ?? c.cap_max!]))
            .filter((w) => w >= c.cap_min! && w <= c.cap_max!).sort((a, b) => a - b) : [];
        return (<PanelSection title="Adrenaline Settings (experimental)">
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Global settings for every game that renders on the AMD eGPU{c.name ? ` (${c.name})` : ""}. Games on the handheld's own GPU never get them; a setting on its default changes nothing.</div></PanelSectionRow>
          {ags?.running && (() => { const st = Object.values(ags.settings ?? {}), on = st.filter((x) => x.state === "active").length, set = st.filter((x) => x.state !== "default").length;
            return <PanelSectionRow><div style={{ fontSize: "12px", padding: "6px 8px", borderRadius: "4px", background: "#57301a", border: "1px solid #ff6a1a" }}>
              <b>Running: {ags.game}</b><div style={{ opacity: 0.85, marginTop: "2px" }}>{set ? `${on} of ${set} changed setting${set > 1 ? "s" : ""} active in this game.` : "Every setting is on its default."}</div></div></PanelSectionRow>; })()}
          {AMD_ROWS.filter((r) => r.key !== "afmf_search" || (cur.afmf ?? "off") !== "off").map((r) => <PanelSectionRow key={r.key}><DropdownItem layout="below" label={r.label} description={`Next game launch. ${r.desc}`} disabled={lock}
            selectedOption={cur[r.key] ?? r.opts[0][0]} rgOptions={r.opts.filter(([d]) => d !== "al2" || amd.al2 || cur[r.key] === "al2").map(([d, l]) => ({ data: d, label: l }))}
            onChange={(o) => saveAmd({ ...cur, [r.key]: o.data })} />
            {ags?.running && <GameState st={ags.settings?.[r.key]} />}</PanelSectionRow>)}
          {(cur.afmf ?? "off") !== "off" && !amd.afmf?.installed && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await amdAfmf(true); setAmdS(await getAmd()); return r; })}>
            Install Fluid Motion Frames (afmf-linux {amd.afmf?.version})</ButtonItem></PanelSectionRow>}
          {amd.afmf?.lsfg && (cur.afmf ?? "off") !== "off" && <PanelSectionRow><div style={{ fontSize: "12px", color: "#ffb36b" }}>lsfg-vk is installed: it is kept out of games while Fluid Motion Frames is on (the two hang together).</div></PanelSectionRow>}
          {String(cur.fsr4 ?? "").startsWith("4.1.2") && !amd.fsr4_412?.installed && <>
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>{amd.fsr4_412?.state === "running" ? amd.fsr4_412.message : `FSR 4.1.2 comes inside AMD's Windows driver package: about 1 GB is downloaded from AMD once, the FSR file is kept (85 MB) and the rest deleted.${amd.fsr4_412?.state === "failed" ? ` ${amd.fsr4_412.message}` : ""}`}</div></PanelSectionRow>
            {amd.fsr4_412?.state !== "running" && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await amdFsr4(true); setAmdS(await getAmd()); return r; })}>Download FSR 4.1.2</ButtonItem></PanelSectionRow>}</>}
          {amd.fsr4_412?.installed && !String(cur.fsr4 ?? "").startsWith("4.1.2") && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await amdFsr4(false); setAmdS(await getAmd()); return r; })}>Remove FSR 4.1.2 (frees 85 MB)</ButtonItem></PanelSectionRow>}
          {cur.fsr4 === "latest" && pr && !pr.tools.some((t) => /GE-Proton/i.test(t.name)) && <>
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>FSR 4 upgrade needs GE-Proton (none installed). {pr.install?.message ?? ""}</div></PanelSectionRow>
            <PanelSectionRow><ButtonItem layout="below" disabled={lock || pr.install?.state === "running"} onClick={() => run(async () => { const r = await installProton(); setTimeout(async () => setPr(await getProton()), 3000); return r; })}>
              {pr.install?.state === "running" ? "Installing GE-Proton…" : "Install latest GE-Proton"}</ButtonItem></PanelSectionRow></>}
          {cur.fsr4 === "latest" && pr?.tools.some((t) => /GE-Proton/i.test(t.name)) && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>FSR 4: pick {pr.tools.filter((t) => /GE-Proton/i.test(t.name)).map((t) => t.name).slice(-1)[0]} for the game (Properties &gt; Compatibility). {pr.install?.state === "done" ? pr.install.message : ""}</div></PanelSectionRow>}
          {once && <PanelSectionRow><ButtonItem layout="below" disabled={lock || !!amd.game} onClick={() => run(() => applyAmd())}>
            {amd.game ? "Exit the game (one-time restart)" : "Apply (one-time Game Mode restart)"}</ButtonItem></PanelSectionRow>}
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{amd.loader === "loaded" ? "Changes apply the next time a game starts; no restart." : "First time only: Game Mode restarts once so Steam starts with the settings loader. After that, changes apply at the next game launch."}</div></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => saveAmd({ ...(amd.defaults ?? {}) })}>Restore defaults</ButtonItem></PanelSectionRow>
          {amd.afmf?.ours && (cur.afmf ?? "off") === "off" && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await amdAfmf(false); setAmdS(await getAmd()); return r; })}>Remove Fluid Motion Frames</ButtonItem></PanelSectionRow>}
          {amd.enabled && <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(async () => { const r = await amdOff(); setAmdEdit(null); setAmdS(await getAmd()); return r; })}>Turn off completely</ButtonItem></PanelSectionRow>}
          {msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
          {caps.length > 1 && <PanelSectionRow><DropdownItem layout="below" label="Power limit" disabled={lock}
            description={`Instant. Within the card's own range (${c.cap_min}-${c.cap_max} W). The card goes back to its default (${c.cap_default ?? "?"} W) when it is unplugged or the machine restarts.`}
            selectedOption={c.cap} rgOptions={caps.map((w) => ({ data: w, label: `${w} W${w === c.cap_default ? " (default)" : ""}` }))}
            onChange={(o) => run(async () => { const r = await setAmdCap(o.data); setAmdS(await getAmd()); return r; })} /></PanelSectionRow>}
          {c.name && <>
            <PanelSectionRow><Field label="Smart Access Memory" focusable>{(c.bar_mb ?? 0) > 256 ? `On · ${Math.round((c.bar_mb ?? 0) / 1024)} GB window` : `Off · ${c.bar_mb ?? "?"} MB window`}</Field></PanelSectionRow>
            <PanelSectionRow><Field label="Clock / memory" focusable>{(c.sclk || "?").replace(/mhz/i, " MHz")} / {(c.mclk || "?").replace(/mhz/i, " MHz")}</Field></PanelSectionRow>
            <PanelSectionRow><Field label="Temperature · power" focusable>{c.temp ?? "?"} °C · {c.power ?? "?"} W</Field></PanelSectionRow>
          </>}
          {!c.name && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>No AMD eGPU attached: the card's power limit and readouts show here when it is.</div></PanelSectionRow>}
          <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.65 }}>* Experimental. Done with what Linux offers: Mesa's own driver options, DXVK and vkd3d-proton (Proton games), handed to each game Steam starts on the AMD eGPU. A game's own launch options and dxvk.conf always win; EGPU_NVT_OFF=1 as a launch option keeps one game out. Frame limit, tearing, VRR, HDR, scaling (FSR / integer) and sharpness are in Steam's own Performance menu, so they are not repeated here.</div></PanelSectionRow>
        </PanelSection>);
      })()}
      {tab === "amd" && amd && !amd.available && <PanelSection title="Adrenaline Settings"><PanelSectionRow><div style={{ fontSize: "12px" }}>Not installed yet: update EGPU Buddy (Setup &amp; updates).</div></PanelSectionRow><PanelSectionRow><ButtonItem layout="below" onClick={() => setTab("main")}>Back</ButtonItem></PanelSectionRow></PanelSection>}
      {tab === "nvidia" && live?.available && (
        <PanelSection title="System settings (live)">
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Instant, also in a running game. These are Steam's own Game Mode settings (the same switches as its Performance menu), for every game on this screen; Steam's per-game profiles can set them back.</div></PanelSectionRow>
          <PanelSectionRow><DropdownItem label="Frame limit" description="System setting · instant" selectedOption={live.fps ?? 0}
            rgOptions={[0, 30, 40, 45, 60, 72, 90, 120, 144].map((f) => ({ data: f, label: f ? `${f} FPS` : "Off" }))}
            onChange={(o) => run(async () => { const r = await setLive("fps", o.data); setLive_(await getLive()); return r; })} /></PanelSectionRow>
          <PanelSectionRow><ToggleField label="Allow tearing" description="System setting · instant. Vertical sync off for the whole screen." checked={!!live.tearing}
            onChange={(v) => run(async () => { const r = await setLive("tearing", v ? 1 : 0); setLive_(await getLive()); return r; })} /></PanelSectionRow>
          <PanelSectionRow><ToggleField label="Variable refresh rate" description="System setting · instant, on screens that support it (testing on NVIDIA). Turning it on asks to keep it; without an answer it switches back in 15 s." checked={!!live.vrr}
            onChange={(v) => run(async () => { const was = live.vrr ?? 0; const r = await setLive("vrr", v ? 1 : 0); setLive_(await getLive());
              if (r.ok && v) showModal(<KeepVrr onDone={async (kept) => { if (kept) await confirmLive(); else await setLive("vrr", was); setLive_(await getLive()); setMsg(kept ? "Variable refresh rate kept." : "Variable refresh rate switched back."); }} />);
              return r; })} /></PanelSectionRow>
          <PanelSectionRow><SliderField label="Upscaling sharpness" description="System setting · instant, with Steam's FSR or NIS scaling filter (0 = sharpest)." value={live.sharpness ?? 2} min={0} max={20} step={1}
            onChange={(v) => run(async () => { const r = await setLive("sharpness", v); setLive_(await getLive()); return r; })} /></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && (
        <PanelSection title="Updates">
          <PanelSectionRow><ToggleField label="Automatic updates" description="Off (default): a new release is only announced here and you decide when to install it. On: it installs by itself when no game is running." checked={!!up?.auto_update} onChange={(v) => run(() => setAutoUpdate(v))} /></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => run(() => checkUpdate(false))}>Check for updates now</ButtonItem></PanelSectionRow>
          <ReleaseNotes label={up?.available ? `What's new in ${up.available}` : "Release notes"} />
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{up ? (up.available ? `Available: ${up.available}` : (up.checked ? "Up to date." : "Not checked yet.")) + (up.last_error ? ` ${up.last_error}` : "") : "…"}</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && (
        <PanelSection title="Extras (testing)">
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>All off by default.</div></PanelSectionRow>
          {!nvb && <PanelSectionRow><ToggleField label="USB4 link speed" description="Adds a USB4 row to the Details tab and warns about a slow cable or port." checked={!!ad?.usb4} onChange={(v) => run(async () => { const r = await setAddon("usb4", v); await refresh(); return r; })} /></PanelSectionRow>}
          <PanelSectionRow><ToggleField label="Handheld screen as touchpad" description={`Off by default. While the handheld screen is off because another screen is in use (XR glasses, a monitor or a TV, with or without an eGPU), the whole touchscreen works as a touchpad: pointer, tap to click (two fingers: right click), two-finger scroll, three-finger drag or double tap to drag. Game Mode and the desktop. Desktop only: four fingers up or down show the window previews, a long swipe left or right switches desktop, five fingers spread out show the desktop and pinched in bring the windows back.${tpad?.active ? " Active now." : ""}`} checked={!!tpad?.enabled} onChange={(v) => run(async () => { const r = await setTouchpad(v); setTpad(await getTouchpad()); return r; })} /></PanelSectionRow>
          {tpad?.enabled && <>
            <PanelSectionRow><SliderField label="Touchpad speed" value={tpad?.speed ?? 2} min={0.5} max={4} step={0.25} showValue editableValue={false} onChange={(v) => { setTpad({ ...tpad, speed: v }); clearTimeout(tpSpeedT); tpSpeedT = setTimeout(() => setTouchpadOption("speed", v.toFixed(2)), 600); }} /></PanelSectionRow>
            <PanelSectionRow><ToggleField label="Invert scroll direction" checked={!!tpad?.invert} onChange={(v) => run(async () => { const r = await setTouchpadOption("invert", v ? "on" : "off"); setTpad(await getTouchpad()); return r; })} /></PanelSectionRow>
            <PanelSectionRow><ToggleField label="Three-finger drag" description="Off: double tap to drag instead (tap, touch again and hold to grab; lifting keeps hold, the next tap lets go)." checked={tpad?.three !== false} onChange={(v) => run(async () => { const r = await setTouchpadOption("drag", v ? "three" : "tap"); setTpad(await getTouchpad()); return r; })} /></PanelSectionRow>
          </>}
          <PanelSectionRow><ToggleField label="TV control tricks" description={`Off by default. Choosing the TV for Game Mode turns it on and switches it to the ${nvb ? "GPU" : "eGPU"}'s HDMI input; while it shows live TV or another input, the desktop leaves it out. LG webOS TVs over the network for now.`} checked={!!tv?.enabled} onChange={(v) => run(() => setTvControl(v))} /></PanelSectionRow>
          {tv?.enabled && (<>
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{tv.paired.length ? `Paired: ${tv.paired.join(", ")}` : "No TV paired yet."}</div></PanelSectionRow>
            <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => { setMsg("Choose Allow on the TV's prompt…"); run(pairTv); }}>{tv.paired.length ? "Pair again" : "Find and pair TV"}</ButtonItem></PanelSectionRow>
          </>)}
          {(tv?.enabled || trm?.cec_remote) && <PanelSectionRow><ToggleField label="Turn the TV off at Safe Detach" description={'Off by default. Puts the TV to standby just before the eGPU lets go of it: through CEC when "TV remote" is on, or over the network for a paired LG TV (works with NVIDIA cards too). Not on a cable pull.'} checked={!!trm?.off_at_detach} onChange={(v) => run(async () => { const r = await setTvOption("off_at_detach", v); setTrm(await getTvRemote()); return r; })} /></PanelSectionRow>}
          {(trm?.cec_here || trm?.cec_remote) && <PanelSectionRow><ToggleField label="TV remote (CEC)" description={'Off by default. Adds "TV controls" to the main page: TV volume and mute through SteamOS\'s own CEC service. Shown only on SteamOS when the TV can be reached over CEC: an AMD card\'s HDMI or CEC-capable adapter, or a USB-CEC adapter in the TV\'s cable (any eGPU, NVIDIA too). Remote part based on cec-mote by xXJSONDeruloXx.'} checked={!!trm?.cec_remote} onChange={(v) => run(async () => { const r = await setTvOption("cec_remote", v); setTrm(await getTvRemote()); return r; })} /></PanelSectionRow>}
          {(trm?.nv_cec?.nvidia && !nvb) && <PanelSectionRow><ToggleField label="NVIDIA CEC (DisplayPort adapter)" description={`Off by default. Lets the NVIDIA card carry HDMI-CEC through a CEC-capable DisplayPort-to-HDMI adapter (EGPU Buddy's patched driver), so "TV remote (CEC)" works on NVIDIA too. Takes effect the next time the eGPU is plugged in.${trm?.nv_cec?.loaded ? " Active now." : ""}${trm?.nv_cec?.rebuild === "running" ? " Driver rebuild running…" : trm?.nv_cec?.rebuild === "done" ? " Driver rebuilt with CEC." : trm?.nv_cec?.rebuild === "failed" ? " The driver rebuild failed: see /var/log/egpu-driver-rebuild.log." : ""}`} checked={!!trm?.nv_cec?.on} onChange={(v) => run(async () => {
            const r = await setTvOption("nvidia_dp_cec", v); setTrm(await getTvRemote());
            // a driver built before the CEC patch: offer to build it again now (the patch is in every build from now on)
            if (v && !trm?.nv_cec?.supported && trm?.nv_cec?.rebuild !== "running") {
              showModal(<ConfirmModal strTitle="Rebuild the NVIDIA driver with CEC?" strDescription="Your patched NVIDIA driver was built before CEC support was added. EGPU Buddy can build it again now with CEC (10-20 minutes, keep the charger in; games keep running on the current driver). The new driver is used the next time the eGPU is plugged in, or after a restart." strOKButtonText="Rebuild now" strCancelButtonText="Later"
                onOK={() => run(async () => { const x = await rebuildDriver(); setTrm(await getTvRemote()); return x; })} />);
            }
            return r; })} /></PanelSectionRow>}
        </PanelSection>
      )}
      {tab === "tv" && (
        <PanelSection title="TV controls">
          {/* Steam's own full-width buttons, one per row: side-by-side buttons overlapped in the Quick Access menu */}
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => tvKey("up"))}>Volume up</ButtonItem></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => tvKey("down"))}>Volume down</ButtonItem></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => tvKey("mute"))}>Mute</ButtonItem></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => tvKey("on"))}>TV on</ButtonItem></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => tvKey("off"))}>TV off</ButtonItem></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={lock} onClick={() => run(() => tvKey("input"))}>Switch TV to the {nvb ? "GPU" : "eGPU"}</ButtonItem></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.75 }}>{trm?.routes.includes("cec") ? "Through CEC (SteamOS's CEC service)." : "Over the network (paired LG TV)."}</div></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" onClick={() => setTab("main")}>Back</ButtonItem></PanelSectionRow>
        </PanelSection>
      )}
    </>
  );
}

// the panel's title: "NV GPU Buddy" in that mode (read once when Decky loads the plugin)
function Title() {
  const [n, setN] = useState(appName());
  useEffect(() => { getSetup().then((x) => { if (x?.track === "nv-gpu-buddy") { APP_NAME.v = "NV GPU Buddy"; setN(APP_NAME.v); } }).catch(() => {}); }, []);
  return <div className={staticClasses.Title}>{n}</div>;
}

export default definePlugin(() => {
  ui("plugin frontend loaded");
  // Keep awake: Steam's own sleep timers stay at Never while it is on and an eGPU is mounted. No eGPU: paused (timers put
  // back, sleep block dropped) but the user's choice stays on, and it resumes when the eGPU is back (also after a reboot).
  // ponytail: 3 minutes of no eGPU before pausing — the Thunderbolt link can take minutes to come up after boot/replug
  let neverSet = false, goneSince = 0, restored = false;
  const awakeCheck = async () => { const a = await getKeepAwake(); if (!a.enabled) { neverSet = false; goneSince = 0; restored = false; return; }
    if (a.egpu) { goneSince = 0; restored = false; if (!a.active) await setKeepAwake(true); if (!neverSet) { await steamSleep(0, 0); neverSet = true; } return; }
    goneSince = goneSince || Date.now();
    if (!restored && Date.now() - goneSince > 180000) { await pauseKeepAwake(); await steamSleep(a.prev[0], a.prev[1]); neverSet = false; restored = true; } };
  awakeCheck().catch(() => {});
  // the finish line must reach the user even when the menu was closed or Decky restarted (plugin update) meanwhile
  const notices = setInterval(async () => { try { const t = await popNotice(); if (t) toaster.toast({ title: appName(), body: t, duration: 15000 }); } catch { /* backend not up yet */ }
    try { await maybeShowTrial(); } catch { /* backend not up yet */ }
    try { await maybeOfferScreen(); } catch { /* backend not up yet */ }
    try { await maybeOfferSteamUi(); } catch { /* backend not up yet */ }
    try { await awakeCheck(); } catch { /* backend not up yet */ }
    try { const ch = await gameResSync(); for (const [id, res] of Object.entries(ch)) (window as any).SteamClient?.Apps?.SetAppResolutionOverride(Number(id), res); } catch { /* backend not up yet */ } }, 5000);
  // a game starting: match its Steam game resolution to the screen Game Mode is on (Setup option, on by default)
  const sc = (window as any).SteamClient, details = () => (window as any).appDetailsStore;
  // a screen or mode change (another screen, XR glasses switched to ultrawide): its best mode, after Steam settles
  let modeTimer: any = null;
  const modes = sc?.System?.DisplayManager?.RegisterForStateChanges?.(() => { clearTimeout(modeTimer); modeTimer = setTimeout(() => applyBestScreenModes().catch(() => {}), 2000); });
  setTimeout(() => applyBestScreenModes().catch(() => {}), 3000);
  const launches = sc?.Apps?.RegisterForGameActionStart?.(async (_id: number, appid: string, action: string) => {
    if (!/launch/i.test(String(action))) return;
    try {
      const id = Number(appid), r = await gameResFor(id, details()?.GetAppDetails(id)?.strResolutionOverride ?? "");
      if (r.set) sc.Apps.SetAppResolutionOverride(id, r.set);
    } catch { /* backend not up yet */ }
  });
  return {
  name: "EGPU Buddy",
  title: <Title />,
  content: <Content />,
  icon: <FaPlug />,
  onDismount() { clearInterval(notices); launches?.unregister?.(); modes?.unregister?.(); clearTimeout(modeTimer); },
};
});
