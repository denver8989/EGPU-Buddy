import { ButtonItem, ConfirmModal, DropdownItem, Field, PanelSection, PanelSectionRow, SliderField, ToggleField, Router, showModal, staticClasses } from "@decky/ui";
import { callable, definePlugin, toaster, useQuickAccessVisible } from "@decky/api";
import { useEffect, useState, useRef } from "react";
import { FaPlug } from "react-icons/fa";
import qrcode from "qrcode-generator";

type Status = {
  present: boolean; bdf: string; driver_loaded: boolean; game_mode: boolean; game_running: boolean; ogui?: boolean;
  attach_pending: boolean; on_egpu: boolean; dock?: string; xgm?: { intro_seen_plugin?: boolean; fan?: string; curve?: number[]; light?: boolean | null; effect?: string; color?: string; speed?: string; brightness?: number; offset?: number[]; power_target?: number | null; live?: { target?: number; cap?: number; draw?: number } }; egpu_handheld?: boolean; handheld_displays?: { name: string; model: string; detail: string; xr?: boolean; brand?: string }[]; output: string;
  gm_status: { state?: string; message?: string }; desktop_status: { state?: string; message?: string };
  link: { speed: string; width: string }; displays: { name: string; enabled: boolean; model: string; detail: string; state: string }[]; audio_sink: string;
  telemetry: Record<string, string>; ts: number; resets?: { count: number; last: string };
};
type Result = { ok: boolean; message: string; rc?: number };

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
// "What's new": loaded from GitHub when opened (what an update brings, or the installed version's notes)
function ReleaseNotes({ label }: { label: string }) {
  const [n, setN] = useState<Notes | null>(null); const [open, setOpen] = useState(false);
  const toggle = () => { setOpen(!open); if (!open && !n) getReleaseNotes().then(setN).catch((e) => setN({ title: "Release notes", notes: [], error: `${e}` })); };
  return (<>
    <PanelSectionRow><ButtonItem layout="below" onClick={toggle}>{open ? "Hide release notes" : label}</ButtonItem></PanelSectionRow>
    {open && <PanelSectionRow><div style={{ fontSize: "12px", lineHeight: 1.4 }}>
      {!n ? "Loading the release notes from GitHub…" : n.error ? n.error : !n.notes.length ? "No release notes found." : (<>
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>{n.title}</div>
        {n.notes.map((r) => <div key={r.version} style={{ marginBottom: "12px" }}><div style={{ opacity: 0.7 }}>{r.version} · {r.date}</div><NotesBody body={r.body} /></div>)}
      </>)}</div></PanelSectionRow>}
  </>);
}
const xgmIntro = callable<[], string>("xgm_intro");   // the XG Mobile intro animation (data URI, or "" once shown)
const xgmIntroDone = callable<[], boolean>("xgm_intro_done");   // light-effect, brightness, offset
const XGM_COLORS: [string, string][] = [["ff0000", "Red"], ["ff6000", "Orange"], ["ffd000", "Yellow"], ["00ff40", "Green"], ["00e0ff", "Cyan"], ["0040ff", "Blue"], ["a000ff", "Purple"], ["ffffff", "White"]];
const resetClocks = callable<[], Result>("reset_clocks");
type Setup = { gm_restart?: boolean; driver_building?: string; started?: number; expect?: string; driver_ready?: boolean; slow_build?: boolean; cmdline_pending?: boolean; installed_vendor?: string; egpu_on_bus?: string; untested?: string; accepted_untested?: boolean; installed_version: string; payload_version: string; needs_reboot: boolean; helpers_present: boolean; busy: boolean; step: string; rc: number | null; progress: number; can_build_driver: boolean; cmdline_missing: string; unsupported: string; log: string };
const getSetup = callable<[], Setup>("get_setup_status");
const acceptUntested = callable<[], Result>("accept_untested");
const installSystem = callable<[boolean, string?], Result>("install_system");
const uninstallSystem = callable<[], Result>("uninstall_system");
const rebootSystem = callable<[], Result>("reboot_system");
const restartGamemode = callable<[], Result>("restart_gamemode");
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
type Trial = { available: boolean; beta: string; tested: string; installed: string; state: string; message: string; running: boolean; log: string; started: number; progress: number; step: string; acked: boolean };
const getTrial = callable<[], Trial>("get_driver_trial");
const startTrial = callable<[], Result>("start_driver_trial");
const revertTrial = callable<[], Result>("revert_driver_trial");
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
      toaster.toast({ title: "EGPU Buddy", body: r.message }); }} />);
};
const ICONS: Record<string, string> = {
  display: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="28" y="4" width="64" height="34" rx="3"/><path d="M52 44 H68 M60 38 V44"/></svg>`,
  handheld: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="16" y="6" width="88" height="36" rx="9"/><rect x="34" y="11" width="52" height="26" rx="2"/><circle cx="25" cy="18" r="3"/><circle cx="95" cy="30" r="3"/></svg>`,
};
// front view used for every pair of XR glasses in the screen list (picture supplied by the project author)
const XR_FRONT = "data:image/webp;base64,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";
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
const Pic = ({ url, white, crop, width }: { url: string; white?: boolean; crop?: boolean; width: number }) => {
  const [src, setSrc] = useState(white ? "" : url);
  useEffect(() => { if (white) cutWhite(url).then(setSrc, () => setSrc(XR_FRONT)); }, [url, white]);
  const own = src !== XR_FRONT;
  return <img src={src || undefined} onError={() => setSrc(XR_FRONT)} style={{ width: `${width}px`, height: "auto", display: "block", minHeight: src ? undefined : "180px",
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
  ...(s.handheld_displays ?? []).map((d) => ({ name: d.name, label: d.model || d.name, xr: !!d.xr, icon: d.xr ? glassesIcon(d.brand) : ICONS.display, photo: d.xr ? XR_FRONT : "",
    detail: `${d.xr ? "XR glasses passthrough" : "External display on the handheld's USB-C"} · ${modeText(d.detail)} · games run on the eGPU` })),
  ...s.displays.filter((d) => d.state !== "off" || tvWakes).map((d) => ({ name: d.name, label: d.model || d.name, xr: false, icon: ICONS.display,
    detail: d.state === "off" ? "Off: choosing it turns it on" : d.detail })),
];
const screenState: Record<string, string> = { "in-use": "on", "other-input": "other input", standby: "asleep", off: "off" };
const vt = (v: string) => (v.match(/\d+/g) ?? ["0"]).slice(0, 3).reduce((a, x) => a * 1000 + Number(x), 0);

const PLUGIN_VERSION = "0.7.151";

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
    <ConfirmModal strTitle={!t ? "Beta driver" : done ? (t.state === "kept" ? `Beta driver ${t.beta} installed` : t.state === "reverted" ? `Back on the tested driver ${t.tested}` : "Beta driver trial failed") : back ? `Returning to the tested driver ${t.tested}` : `Installing beta driver ${t.beta}`}
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
  if (recent && (t.running || (["kept", "reverted", "failed"].includes(t.state) && !t.acked))) { trialOpen = true; showModal(<TrialModal />); }
};

function Content() {
  const visible = useQuickAccessVisible();
  const [tab, setTab] = useState<"main" | "details" | "setup">("main");
  const [logOpen, setLogOpen] = useState<"" | "setup" | "trial">("");   // logs stay folded away unless asked for
  const [su, setSu] = useState<Setup | null>(null);
  const [up, setUp] = useState<Upd | null>(null);
  const [tv, setTv] = useState<{ enabled: boolean; paired: string[] } | null>(null);
  const [ad, setAd] = useState<Addons | null>(null);
  const [usb4, setUsb4] = useState<{ name?: string; per_lane?: number; lanes?: number; total?: number; slow?: boolean }>({});
  const [report, setReport] = useState<{ code: string; file: string; url: string } | null>(null);
  const [gr, setGr] = useState<{ enabled: boolean } | null>(null);
  const [tr, setTr] = useState<Trial | null>(null);
  const staleChecked = useRef(false);
  const [confirmSetup, setConfirmSetup] = useState<"" | "install" | "amd">("");
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

  const refresh = async () => { try { setS(await getStatus()); setSu(await getSetup()); const u = await getUpdate(); setUp(u); setTv(await getTvControl()); const a = await getAddons(); setAd(a); setUsb4(a.usb4 ? await getUsb4() : {}); setGr(await getGameRes()); setTr(await getTrial());
    // the hourly check only counts awake time: after a night of sleep the status is stale, so re-check on open (wall clock)
    if (!staleChecked.current && (!u.checked || Date.now() / 1000 - u.checked > 600)) { staleChecked.current = true; checkUpdate(false); }
  } catch (e) { setMsg(`status error: ${e}`); } };
  // DDC/CI reads are slow-ish and some screens dislike polling: read once when details open
  useEffect(() => { if (visible && tab === "details") getScreens().then(setScr).catch(() => setScr(null)); }, [visible, tab]);
  useEffect(() => { if (!visible) return; refresh(); const t = setInterval(refresh, su?.busy ? 1000 : 3000); return () => clearInterval(t); }, [visible, su?.busy]);

  // Bazzite: with OpenGamepadUI running, Steam's running-app entry can be OpenGamepadUI itself; there the backend's check decides
  const gameUp = !!(s?.game_running || (!s?.ogui && Router.MainRunningApp));
  const run = async (fn: () => Promise<Result>) => { setBusy(true); try { const r = await fn(); setMsg(r.message); } catch (e) { setMsg(`${e}`); } finally { setBusy(false); refresh(); } };

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
  const controlsOk = !!(s?.present && s?.driver_loaded && s?.on_egpu);
  // "mounted" for uninstall purposes: the driver is loaded, so /usr cannot be written and the
  // extension cannot be unmerged. Detaching is what clears it.
  const egpuMounted = !!(s?.driver_loaded);
  const tvWakes = !!tv?.enabled && !!tv?.paired.length;   // TV control can switch a TV that is off on
  const askUninstall = () => showModal(<ConfirmModal strTitle="Uninstall EGPU Buddy?" bDestructiveWarning strOKButtonText="Uninstall"
    strDescription={(egpuMounted ? "The eGPU is safely detached first: Game Mode moves to the handheld screen for a few seconds. " : "") + "Then the system integration is removed and the machine goes back to how it was."}
    onOK={() => run(uninstallSystem)} />);
  const WHAT = "Installs the hot-plug scripts, the Game Mode session, the GBM gamescope, the boot policy, the desktop app, the patched hot-unplug driver with the NVIDIA userspace pinned to it, and the kernel parameters. Backups are kept.";
  const confirmInstall = (title: string, go: () => Promise<Result>, detachGo?: () => Promise<Result>) => {
    const needAccept = !!(su?.untested && !su.accepted_untested);
    if (detachGo && up?.needs_detach && !needAccept) {   // SteamOS with the eGPU in use: the update cannot be written until it is detached
      showModal(<ConfirmModal strTitle={`${title}: the eGPU is in use`} strOKButtonText="Detach and update" bDestructiveWarning
        strDescription={"The eGPU is detached first: Game Mode moves to the handheld screen and the monitor loses signal. Leave the cable plugged in. Then the update installs" + (su?.slow_build ? " (a driver rebuild can take 10-20 minutes; keep the charger connected)" : "") + ". When it is done the eGPU is attached again by itself and Game Mode returns to its screen. A notification tells you each step."}
        onOK={() => run(detachGo)} />);
      return;
    }
    const time = ` Expected time: ${su?.expect ?? "several minutes"}.` + (su?.slow_build ? " The driver is built on /home; the system partition is not touched. Keep the charger connected and the eGPU unplugged." : "") + " You can close the menu meanwhile; a notification appears when it is done.";
    const disclaimer = needAccept ? `NOT TESTED ON THIS HARDWARE: ${su!.untested!.split("\n").join("; ")}. This project was verified on one machine only (Legion Go 2, RTX 5060 Ti, CachyOS). Here it may not work, may leave the screen dark, or may need a reboot to recover. You install and test it at your own risk.\n\n` : "";
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
  const installClick = () => confirmInstall(su?.installed_version ? "Update the system files" : "Install", () => installSystem(false), su?.installed_version ? () => updateDetached("") : undefined);
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
      </PanelSection>
      {tab === "main" && (
        <PanelSection title="eGPU">
          <PanelSectionRow><div className={staticClasses.Text}>{s ? stateLine(s) : "Loading…"}</div></PanelSectionRow>
          {su?.unsupported && <PanelSectionRow><div style={{ fontSize: "12px", color: "#ff6b6b" }}>{su.unsupported}</div></PanelSectionRow>}
          {su?.driver_building && !su.busy && (
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{su.driver_building.includes("prebuild") ? "A SteamOS update is ready: EGPU Buddy is preparing the eGPU driver for it. Restart once it says it is done." : "SteamOS changed the kernel: EGPU Buddy is building the eGPU driver for it in the background (a few minutes). The eGPU works again by itself when it is done; nothing to install."}</div></PanelSectionRow>
          )}
          {needsInstall && su && !su.busy && su.rc !== 0 && (
            <>
              <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{su.installed_version && !su.helpers_present ? "System files are missing (OS update)." : behind ? `Plugin ${su.payload_version} is in; its system files finish installing by themselves (after any running game is closed), or press Update system integration.` : driverMissing ? "The NVIDIA driver is not installed. Keep the eGPU unplugged." : su.installed_version ? "Setup is incomplete." : "Not installed yet."}</div></PanelSectionRow>
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
          {su && !su.busy && su.rc !== null && su.rc !== 0 && <PanelSectionRow><div style={{ fontSize: "12px", color: "#ff6b6b" }}>{su.rc === 21 ? "Nothing was changed: the eGPU driver is in use. Safe Detach, unplug the eGPU, then try again." : su.rc === 20 ? "Everything is installed except the NVIDIA driver, which could not be built. Keep the eGPU unplugged, check the internet connection and press Repair. Details: Show setup & updates." : `Install failed (rc ${su.rc}). Log: /tmp/egpu-buddy-setup.log`}</div></PanelSectionRow>}
          {!!s?.resets?.count && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>This device was reset by its hardware {s.resets.count === 1 ? "once" : `${s.resets.count} times`} while the eGPU was connected (last: {s.resets.last}). Always use Safe Detach before unplugging.</div></PanelSectionRow>}
          {s && !s.game_mode && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>In Desktop mode use the EGPU Buddy desktop app.</div></PanelSectionRow>}
          {gameUp && s?.game_mode && <PanelSectionRow><div style={{ fontSize: "12px", color: "#f0b429" }}>A game is running. Exit it first to switch screens, attach or detach the eGPU: each of these restarts Game Mode.</div></PanelSectionRow>}
          {s?.attach_pending && <PanelSectionRow><div style={{ fontSize: "12px" }}>eGPU plugged in. Close the game, then press Attach.</div></PanelSectionRow>}
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !s?.game_mode || gameUp || (s?.present && (s?.on_egpu || s?.egpu_handheld))} onClick={() => showModal(<ConfirmModal strTitle="Attach the eGPU" strDescription="Game Mode restarts on the eGPU display: the screen goes dark for a few seconds. When it is back, reopen this menu to see the result." strOKButtonText="Attach" onOK={() => run(() => attach(false))} />)}>Attach eGPU</ButtonItem>
          </PanelSectionRow>
          {s?.game_mode && (s.on_egpu || s.egpu_handheld) && screenTargets(s, tvWakes).filter((t) => t.name !== s.output).map((t) => (
            <PanelSectionRow key={t.name}><ButtonItem layout="below" disabled={busy || gameUp}
              onClick={() => showModal(<ConfirmModal strTitle={`Show Game Mode on ${t.label}`} strDescription={`${t.detail}\n\nGame Mode restarts on that screen (the current one goes dark for a few seconds). Switch back the same way.`}
                strOKButtonText="Switch" onOK={() => run(() => setGameScreen(t.name))} />)}>
                {/* picture above the text: beside it, the text was squeezed into a narrow column */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}><span style={{ flex: "0 0 auto" }}>{(t as any).photo ? <img src={(t as any).photo} style={{ width: "96px", height: "auto", display: "block" }} /> : <span dangerouslySetInnerHTML={{ __html: t.icon }} />}</span>
                  <div style={{ textAlign: "center" }}>Show Game Mode on {t.label}{t.xr && <span style={{ fontSize: "10px", background: "#1a9fff", borderRadius: "2px", padding: "0 4px", marginLeft: "6px" }}>XR</span>}
                    <div style={{ fontSize: "11px", opacity: 0.7 }}>{t.detail}</div></div></div></ButtonItem></PanelSectionRow>
          ))}
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !s?.game_mode || !s?.present || gameUp} onClick={() => showModal(<ConfirmModal strTitle="Safe Detach" strDescription="Game Mode moves to the handheld screen and the eGPU is removed from the bus: the screen goes dark for a few seconds and the monitor loses signal. Do not unplug yet. When the handheld screen is back, reopen this menu: it says when it is safe to unplug the cable." strOKButtonText="Detach" bDestructiveWarning onOK={() => run(safeDetach)} />)}>Safe Detach</ButtonItem>
          </PanelSectionRow>
          {s?.gm_status?.state && s.gm_status.state !== "ATTACHED" && s.gm_status.state !== "IDLE" && <PanelSectionRow><div style={{ fontSize: "13px", fontWeight: 600, color: s.gm_status.state === "SAFE_COMPLETE" || s.gm_status.state === "DETACHED" ? "#4caf50" : s.gm_status.state.includes("DO_NOT") || s.gm_status.state === "FAILED" ? "#ff6b6b" : "#f0b429" }}>{s.gm_status.state === "SAFE_COMPLETE" || s.gm_status.state === "DETACHED" ? "Safe to unplug the cable." : s.gm_status.message}</div></PanelSectionRow>}
          {tr?.message && (tr.running || tr.state === "reverted" || tr.state === "failed") && <PanelSectionRow><div style={{ fontSize: "12px", color: tr.state === "failed" ? "#ff6b6b" : "#f0b429" }}>Beta driver: {tr.message}</div></PanelSectionRow>}
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
          <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.7 }}>EGPU Buddy {PLUGIN_VERSION}{su && !su.installed_version ? " · not installed" : ""} · {up ? (up.available ? `update ${up.available} available` : up.checked ? "up to date" : "update check pending") : "…"}{up?.auto_update ? " · auto-update on" : " · auto-update off"}</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "details" && !s && (
        <PanelSection title="eGPU details">
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>No eGPU connected. Setup, updates and uninstall are still available above.</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "details" && s && (
        <>
          <PanelSection title="eGPU details">
            {!s.present ? (
              <>
                <PanelSectionRow><div className={staticClasses.Text}>eGPU not connected.</div></PanelSectionRow>
                <Row k="Session" v={s.game_mode ? "Game Mode on handheld" : "Desktop"} />
              </>
            ) : (
            <>
              {/* the dock on its own row: "ASUS ROG XG Mobile · RTX 5070 Ti Laptop GPU" on one row was cut off on the panel */}
              {s.dock && <Row k="Dock" v={s.dock} />}
              <Row k="GPU" v={gpuName(tel["name"]) || (s.present ? s.bdf : "absent")} />
              <Row k="Driver" v={s.driver_loaded ? `nvidia ${tel["driver_version"] ?? ""}` : "not loaded"} />
              <Row k="PCIe" v={s.present ? `${s.link.speed} x${s.link.width}` : ""} />
              {ad?.usb4 && usb4.total !== undefined && (
                <PanelSectionRow><div style={{ padding: "6px 8px", borderRadius: "4px", fontSize: "12px",
                  background: usb4.slow ? "#3a2a14" : "#1a3a57", border: `1px solid ${usb4.slow ? "#e3a33b" : "#1a9fff"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600 }}>USB4 link</span><b>{usb4.total} Gb/s · {usb4.lanes} × {usb4.per_lane}</b></div>
                  <div style={{ opacity: 0.85, marginTop: "2px" }}>{usb4.slow ? (usb4.lanes! < 2 ? "1 lane: check the cable or port" : "slow link: check the cable or port") : usb4.name}</div>
                </div></PanelSectionRow>
              )}
              <Row k="Session" v={s.game_mode ? (s.on_egpu ? `Game Mode on ${screenName(s)}` : s.egpu_handheld ? `${s.output.startsWith("eDP") ? "Handheld" : screenName(s)} + eGPU` : "Game Mode on panel") : "Desktop"} />
              {/* one row per screen: a joined list got cut off on the panel */}
              {(scr?.length ? scr : s.displays.map((d) => ({ connector: d.name, name: d.model, state: d.enabled ? "" : "off" }))).map((x) => (
                <Row key={x.connector} k={x.name || x.connector}
                  v={[screenState[x.state], x.connector.startsWith("HDMI") ? "HDMI" : x.connector.startsWith("DP") ? "DisplayPort" : x.connector].filter(Boolean).join(" · ")} />
              ))}
              {scr?.some((x) => x.ddc) && <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => run(async () => { const r = await wakeScreens(); getScreens().then(setScr).catch(() => {}); return r; })}>Wake screens</ButtonItem></PanelSectionRow>}
              <Row k="Audio" v={audioName(s.audio_sink, s.bdf)} />
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
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={async () => { setReport(null); try { setReport(await makeReport()); } catch { setMsg("Could not make the report."); } }}>Save support report to Desktop</ButtonItem></PanelSectionRow>
              {report && (<>
                <PanelSectionRow><div style={{ fontSize: "12px" }}>Scan with your phone to open a new GitHub issue with the report summary filled in. The full report is saved as <b>{report.file}</b>: attach it to the issue.</div></PanelSectionRow>
                <PanelSectionRow><div style={{ width: "240px", margin: "0 auto", background: "#fff", borderRadius: "4px" }} dangerouslySetInnerHTML={{ __html: qrSvg(report.url) }} /></PanelSectionRow>
                <Row k="Code" v={report.code} />
              </>)}
              <PanelSectionRow><div style={{ fontSize: "11px", opacity: 0.75 }}>One file with everything EGPU Buddy logs (versions, GPU and link, screens, Game Mode, attach, Safe Detach, driver trial and the system log), saved in the Desktop folder. Also in Desktop Mode: the "Save EGPU Buddy report" icon. No serial numbers, Wi-Fi names, IP addresses or user names.</div></PanelSectionRow>
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
              <PanelSectionRow><ButtonItem layout="below" disabled={busy || pt === null} onClick={() => { const w = ptNow >= xgTop ? 0 : ptNow; setPt(null); run(() => xgmPower(w)); }}>Apply power target</ButtonItem></PanelSectionRow>
              </>)}
              <PanelSectionRow>
                <DropdownItem label="Fan mode" selectedOption={s.xgm?.fan ?? "auto"} disabled={busy}
                  rgOptions={[["auto", "Auto (the XG Mobile's own)"], ["quiet", "Quiet"], ["balanced", "Balanced"], ["performance", "Performance"], ["max", "Max"],
                    ...(s.xgm?.curve ? [["custom", "Custom (made in the desktop app)"]] : [])].map(([data, label]) => ({ data, label }))}
                  onChange={(o) => run(() => xgmFan(String(o.data)))} />
              </PanelSectionRow>
              <PanelSectionRow><ToggleField label="Lights" checked={lightOn} disabled={busy} onChange={(v) => run(() => xgmLight(v))} /></PanelSectionRow>
              {lightOn && (<>
              <PanelSectionRow>
                <DropdownItem label="Light effect" selectedOption={s.xgm?.effect ?? "static"} disabled={busy}
                  rgOptions={[["static", "Static"], ["breathe", "Breathe"], ["cycle", "Color cycle"], ["rainbow", "Rainbow"], ["strobe", "Strobe"]].map(([data, label]) => ({ data, label }))}
                  onChange={(o) => lightFx(String(o.data))} />
              </PanelSectionRow>
              <PanelSectionRow>
                <DropdownItem label="Light color" selectedOption={s.xgm?.color ?? "ff0000"} disabled={busy}
                  rgOptions={XGM_COLORS.map(([data, label]) => ({ data, label }))} onChange={(o) => lightFx("", String(o.data))} />
              </PanelSectionRow>
              <PanelSectionRow>
                <DropdownItem label="Light speed" selectedOption={s.xgm?.speed ?? "normal"} disabled={busy}
                  rgOptions={[["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]].map(([data, label]) => ({ data, label }))} onChange={(o) => lightFx("", "", String(o.data))} />
              </PanelSectionRow>
              <PanelSectionRow>
                <SliderField label="Light brightness" value={s.xgm?.brightness ?? 3} min={0} max={3} step={1} notchCount={4} notchTicksVisible showValue disabled={busy}
                  onChange={(v) => run(() => xgmSet("brightness", String(v)))} />
              </PanelSectionRow>
              </>)}
              <PanelSectionRow>
                <SliderField label="Core clock offset (MHz)" value={xoffNow[0]} min={-300} max={300} step={15} showValue onChange={(v) => setXoff([v, xoffNow[1]])} />
              </PanelSectionRow>
              <PanelSectionRow>
                <SliderField label="Memory clock offset (MHz)" value={xoffNow[1]} min={-1000} max={1500} step={50} showValue onChange={(v) => setXoff([xoffNow[0], v])} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy || xoff === null} onClick={() => { const [c, m] = xoffNow; setXoff(null); run(() => xgmSet("offset", `${c}:${m}`)); }}>Apply clock offsets</ButtonItem></PanelSectionRow>
              {!controlsOk && msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
            </PanelSection>
          )}
          {!s.present ? null : controlsOk ? (
            <PanelSection title="Power controls">
              {plOk ? (<>
              <PanelSectionRow>
                <SliderField label="Power limit (W)" value={plNow} min={plMin} max={plMax} step={5} showValue onChange={setPl} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy || pl === null} onClick={() => run(() => setPowerLimit(plNow))}>Apply power limit</ButtonItem></PanelSectionRow>
              </>) : (
              <>
              {!xg && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>This GPU does not take a power limit from the driver (a laptop-class GPU, as in an ASUS XG Mobile): the dock sets its power{xgCap !== null ? ` (cap now ${xgCap} W${Number.isFinite(plMax) ? `, at most ${Math.round(plMax)} W` : ""})` : ""}. Limit its clock instead to lower power and heat.</div></PanelSectionRow>}
              {!xg && clkMax > 0 && (<>
              <PanelSectionRow>
                <SliderField label="Max GPU clock (MHz)" value={clkNow} min={clkMin} max={clkMax} step={15} showValue onChange={setClk} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy || clk === null} onClick={() => run(() => setClockLimit(clkNow))}>Apply clock limit</ButtonItem></PanelSectionRow>
              </>)}
              </>
              )}
              {!xg && (<>
              <PanelSectionRow>
                <SliderField label="Core clock offset (MHz)" value={off} min={-300} max={300} step={15} showValue onChange={setOff} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => run(() => setCoreOffset(off))}>Apply offset</ButtonItem></PanelSectionRow>
              </>)}
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => { setOff(0); setPl(null); setClk(null); setPt(null); setXoff(null); run(resetClocks); }}>Reset clocks</ButtonItem></PanelSectionRow>
              {msg && <PanelSectionRow><div style={{ fontSize: "12px" }}>{msg}</div></PanelSectionRow>}
            </PanelSection>
          ) : (
            <PanelSection title="Power controls"><PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Available when Game Mode runs on the eGPU. On the handheld GPU, Game Mode's own performance menu applies.</div></PanelSectionRow></PanelSection>
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
            <ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => { if (confirmSetup === "install") { setConfirmSetup(""); run(() => installSystem(false)); } else setConfirmSetup("install"); }}>
              {confirmSetup === "install"
                ? "Press again to confirm"
                : (su?.installed_version ? "Reinstall / update system integration" : "NVIDIA eGPU - install (builds the driver)")}
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
            <ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => { if (confirmSetup === "amd") { setConfirmSetup(""); run(() => installSystem(false, "amd")); } else setConfirmSetup("amd"); }}>
              {confirmSetup === "amd"
                ? "Press again to confirm"
                : (su?.installed_version ? "Switch to the AMD / Intel install (no NVIDIA driver)" : "AMD / Intel eGPU - install (no driver build)")}
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
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={busy || !!su?.busy || !su?.installed_version} onClick={askUninstall}>Uninstall system integration</ButtonItem>
          </PanelSectionRow>
          {su?.log && <PanelSectionRow><ButtonItem layout="below" onClick={() => setLogOpen(logOpen === "setup" ? "" : "setup")}>{logOpen === "setup" ? "Hide install log" : "Show install log"}</ButtonItem></PanelSectionRow>}
          {su?.log && logOpen === "setup" && <PanelSectionRow><div style={{ fontSize: "10px", whiteSpace: "pre-wrap", opacity: 0.8 }}>{su.log}</div></PanelSectionRow>}
        </PanelSection>
      )}
      {tab === "setup" && tr?.available && (
        <PanelSection title="Beta driver (advanced)">
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.85 }}>
            Tested driver: {tr.tested}. Beta: {tr.beta}, with the same eGPU patches ported to it. Running now: {tr.installed || "not installed"}.
          </div></PanelSectionRow>
          {tr.message && <PanelSectionRow><div style={{ fontSize: "12px", color: tr.state === "failed" ? "#ff6b6b" : tr.state === "kept" ? "#4caf50" : "#f0b429" }}>{tr.message}</div></PanelSectionRow>}
          {tr.state !== "kept" && (
            <PanelSectionRow><ButtonItem layout="below" disabled={busy || tr.running || !!su?.busy || gameUp || !s?.game_mode}
              onClick={() => showModal(<ConfirmModal strTitle={`Try beta driver ${tr.beta}`}
                strDescription={`For testers. The eGPU is safely detached, the beta NVIDIA driver ${tr.beta} is downloaded from NVIDIA (about 530 MB) and built on this device (10-20 minutes, about 6 GB free space needed while building), then the eGPU is attached with it and checked. If it does not come up, the tested driver ${tr.tested} is put back and attached again by itself. If the machine resets or hangs during the test, the tested driver is put back at the next boot, before the eGPU is used. Keep the charger and the eGPU connected. Everything is logged to /var/log/egpu-driver-trial.log.`}
                strOKButtonText="Try the beta driver" bDestructiveWarning onOK={() => run(startTrial)} />)}>Try beta driver {tr.beta}</ButtonItem></PanelSectionRow>
          )}
          {(tr.state === "kept" || (tr.installed && tr.installed !== tr.tested)) && (
            <PanelSectionRow><ButtonItem layout="below" disabled={busy || tr.running || gameUp || !s?.game_mode}
              onClick={() => showModal(<ConfirmModal strTitle={`Return to ${tr.tested}`} strDescription={`The eGPU is safely detached, the tested driver ${tr.tested} is put back (offline, a few minutes) and the eGPU is attached again.`}
                strOKButtonText="Return" onOK={() => run(revertTrial)} />)}>Return to the tested driver {tr.tested}</ButtonItem></PanelSectionRow>
          )}
          {tr.log && <PanelSectionRow><ButtonItem layout="below" onClick={() => setLogOpen(logOpen === "trial" ? "" : "trial")}>{logOpen === "trial" ? "Hide driver log" : "Show driver log"}</ButtonItem></PanelSectionRow>}
          {tr.log && logOpen === "trial" && <PanelSectionRow><div style={{ fontSize: "10px", whiteSpace: "pre-wrap", opacity: 0.8 }}>{tr.log}</div></PanelSectionRow>}
        </PanelSection>
      )}
      {tab === "setup" && s?.present && s.game_mode && (
        <PanelSection title="Game screen">
          <PanelSectionRow><DropdownItem label="Play games on" disabled={busy || gameUp}
            selectedOption={s.output && s.output !== "*" ? s.output : "eDP-1"}
            rgOptions={screenTargets(s, tvWakes).map((t) => ({ data: t.name, label: t.name === "eDP-1" ? "Handheld screen (games on the eGPU)" : t.label }))}
            onChange={(o) => { if (o.data !== s.output) run(() => setGameScreen(o.data)); }} /></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{gameUp ? "Exit the game first: switching screens restarts Game Mode." : "Switching restarts Game Mode on the chosen screen (dark for a few seconds)."}</div></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>XR glasses passthrough: glasses plugged into the handheld's USB-C show your eGPU games, with no HDMI-to-USB-C adapter on the eGPU needed.</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && gr && (
        <PanelSection title="Games">
          <PanelSectionRow><ToggleField label="Best resolution and refresh rate on every screen" description="On by default. Steam runs big external screens (XR glasses in ultrawide, 1440p, 4K) at 1920x1080 and starts games there with black bars. With this on, Game Mode uses each screen's highest resolution and refresh rate, follows the glasses into and out of ultrawide, and games start at the screen's size. Games you set yourself are left alone; switching this off leaves Steam's settings as they are." checked={gr.enabled} onChange={(v) => run(async () => { const r = await setGameRes(v); setGr(await getGameRes()); return r; })} /></PanelSectionRow>
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
          <PanelSectionRow><ToggleField label="USB4 link speed" description="Adds a USB4 row to the Details tab and warns about a slow cable or port." checked={!!ad?.usb4} onChange={(v) => run(async () => { const r = await setAddon("usb4", v); await refresh(); return r; })} /></PanelSectionRow>
          <PanelSectionRow><ToggleField label="TV control tricks" description="Off by default. Choosing the TV for Game Mode turns it on and switches it to the eGPU's HDMI input; while it shows live TV or another input, the desktop leaves it out. LG webOS TVs over the network for now." checked={!!tv?.enabled} onChange={(v) => run(() => setTvControl(v))} /></PanelSectionRow>
          {tv?.enabled && (<>
            <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{tv.paired.length ? `Paired: ${tv.paired.join(", ")}` : "No TV paired yet."}</div></PanelSectionRow>
            <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => { setMsg("Choose Allow on the TV's prompt…"); run(pairTv); }}>{tv.paired.length ? "Pair again" : "Find and pair TV"}</ButtonItem></PanelSectionRow>
          </>)}
        </PanelSection>
      )}
    </>
  );
}

export default definePlugin(() => {
  // the finish line must reach the user even when the menu was closed or Decky restarted (plugin update) meanwhile
  const notices = setInterval(async () => { try { const t = await popNotice(); if (t) toaster.toast({ title: "EGPU Buddy", body: t, duration: 15000 }); } catch { /* backend not up yet */ }
    try { await maybeShowTrial(); } catch { /* backend not up yet */ }
    try { await maybeOfferScreen(); } catch { /* backend not up yet */ }
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
  title: <div className={staticClasses.Title}>EGPU Buddy</div>,
  content: <Content />,
  icon: <FaPlug />,
  onDismount() { clearInterval(notices); launches?.unregister?.(); modes?.unregister?.(); clearTimeout(modeTimer); },
};
});
