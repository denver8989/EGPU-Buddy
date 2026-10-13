import { ButtonItem, ConfirmModal, DropdownItem, Field, PanelSection, PanelSectionRow, SliderField, ToggleField, Router, showModal, staticClasses } from "@decky/ui";
import { callable, definePlugin, toaster, useQuickAccessVisible } from "@decky/api";
import { useEffect, useState, useRef } from "react";
import { FaPlug } from "react-icons/fa";

type Status = {
  present: boolean; bdf: string; driver_loaded: boolean; game_mode: boolean; game_running: boolean;
  attach_pending: boolean; on_egpu: boolean; egpu_handheld?: boolean; handheld_displays?: { name: string; model: string; detail: string; xr?: boolean; brand?: string }[]; output: string;
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
const resetClocks = callable<[], Result>("reset_clocks");
type Setup = { gm_restart?: boolean; started?: number; expect?: string; driver_ready?: boolean; slow_build?: boolean; cmdline_pending?: boolean; installed_vendor?: string; egpu_on_bus?: string; untested?: string; accepted_untested?: boolean; installed_version: string; payload_version: string; needs_reboot: boolean; helpers_present: boolean; busy: boolean; step: string; rc: number | null; progress: number; can_build_driver: boolean; cmdline_missing: string; unsupported: string; log: string };
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
const popNotice = callable<[], string>("pop_notice");
type Trial = { available: boolean; beta: string; tested: string; installed: string; state: string; message: string; running: boolean; log: string; started: number; progress: number; step: string; acked: boolean };
const getTrial = callable<[], Trial>("get_driver_trial");
const startTrial = callable<[], Result>("start_driver_trial");
const revertTrial = callable<[], Result>("revert_driver_trial");
const ackTrial = callable<[], Result>("ack_driver_trial");
type Screen = { connector: string; name: string; state: string; ddc: boolean };
const getScreens = callable<[], Screen[]>("get_screens");
const wakeScreens = callable<[], Result>("wake_screens");
const getScreenOffer = callable<[], { connector?: string; name?: string; detail?: string; game?: boolean }>("get_screen_offer");
const setGameScreen = callable<[string], Result>("set_game_screen");
const getTvControl = callable<[], { enabled: boolean; paired: string[] }>("get_tv_control");
const setTvControl = callable<[boolean], Result>("set_tv_control");
const pairTv = callable<[], Result>("pair_tv");
const getGameRes = callable<[], { enabled: boolean }>("get_game_res");
const setGameRes = callable<[boolean], Result>("set_game_res");
const gameResFor = callable<[number, string], { set?: string }>("game_res_for");
const gameResSync = callable<[], Record<string, string>>("game_res_sync");
// a screen plugged into the eGPU while Game Mode runs on another one: offer to move (one screen at a time)
const maybeOfferScreen = async () => {
  const o = await getScreenOffer();
  if (!o.connector) return;
  showModal(<ConfirmModal strTitle={`${o.name} connected`}
    strDescription={o.game ? `Close the running game first, then use "Show Game Mode on ${o.name}" in EGPU Buddy.`
      : `${o.detail}\n\nShow Game Mode on ${o.name}? Game Mode restarts on it (the screen goes dark for a few seconds). You can switch back from EGPU Buddy.`}
    strOKButtonText={o.game ? "OK" : "Switch"} strCancelButtonText="Stay here"
    onOK={async () => {
      if (o.game) return;
      const r = await setGameScreen(o.connector!);
      toaster.toast({ title: "EGPU Buddy", body: r.message }); }} />);
};
// Original line-art icons (no third-party images), drawn after each brand family's lens shape.
const lens = (l: string, r: string, brow = "") => `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M4 14 L14 12"/><path d="M116 14 L106 12"/>${brow}<path d="${l}" fill="currentColor" fill-opacity=".18"/><path d="${r}" fill="currentColor" fill-opacity=".18"/><path d="M53 16 Q60 11 67 16"/></svg>`;
const ICONS: Record<string, string> = {
  viture: lens("M14 12 H53 V30 Q53 38 44 38 H23 Q14 38 14 29 Z", "M67 12 H106 V29 Q106 38 97 38 H76 Q67 38 67 30 Z", `<path d="M14 12 H106" stroke-width="3.2"/>`),
  wayfarer: lens("M12 11 H54 L50 34 Q48 38 43 38 H22 Q16 38 15 33 Z", "M66 11 H108 L105 33 Q104 38 98 38 H77 Q72 38 70 34 Z"),
  round: lens("M14 22 Q14 11 33 11 Q53 11 53 22 Q53 38 33 38 Q14 38 14 22 Z", "M67 22 Q67 11 87 11 Q106 11 106 22 Q106 38 87 38 Q67 38 67 22 Z"),
  display: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="28" y="4" width="64" height="34" rx="3"/><path d="M52 44 H68 M60 38 V44"/></svg>`,
  handheld: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="16" y="6" width="88" height="36" rx="9"/><rect x="34" y="11" width="52" height="26" rx="2"/><circle cx="25" cy="18" r="3"/><circle cx="95" cy="30" r="3"/></svg>`,
};
const glassesIcon = (brand?: string) => brand === "viture" ? ICONS.viture : /xreal|nreal/.test(brand ?? "") ? ICONS.wayfarer : ICONS.round;
// "3840x1200 @ 60 Hz" -> "Ultrawide 32:9 · 3840x1200 @ 60 Hz" when the screen is that wide (glasses switched to ultrawide)
const modeText = (detail: string) => { const m = detail.match(/(\d+)x(\d+) @ \d+ Hz/); if (!m) return "";
  return (Number(m[1]) / Number(m[2]) >= 3 ? "Ultrawide 32:9 · " : "") + m[0]; };
// every screen Game Mode can go to while the eGPU is attached: the handheld itself, screens on its USB-C (XR glasses),
// and the eGPU's monitors/TVs (an off TV only when TV control can switch it on)
const screenTargets = (s: Status, tvWakes: boolean) => [
  { name: "eDP-1", label: "the handheld screen", detail: "Games still run on the eGPU", icon: ICONS.handheld, xr: false },
  ...(s.handheld_displays ?? []).map((d) => ({ name: d.name, label: d.model || d.name, xr: !!d.xr, icon: d.xr ? glassesIcon(d.brand) : ICONS.display,
    detail: `${d.xr ? "XR glasses passthrough" : "External display on the handheld's USB-C"} · ${modeText(d.detail)} · games run on the eGPU` })),
  ...s.displays.filter((d) => d.state !== "off" || tvWakes).map((d) => ({ name: d.name, label: d.model || d.name, xr: false, icon: ICONS.display,
    detail: d.state === "off" ? "Off: choosing it turns it on" : d.detail })),
];
const screenState: Record<string, string> = { "in-use": "on", "other-input": "other input", standby: "asleep", off: "off" };
const vt = (v: string) => (v.match(/\d+/g) ?? ["0"]).slice(0, 3).reduce((a, x) => a * 1000 + Number(x), 0);

const PLUGIN_VERSION = "0.7.97";

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

  const refresh = async () => { try { setS(await getStatus()); setSu(await getSetup()); const u = await getUpdate(); setUp(u); setTv(await getTvControl()); setGr(await getGameRes()); setTr(await getTrial());
    // the hourly check only counts awake time: after a night of sleep the status is stale, so re-check on open (wall clock)
    if (!staleChecked.current && (!u.checked || Date.now() / 1000 - u.checked > 600)) { staleChecked.current = true; checkUpdate(false); }
  } catch (e) { setMsg(`status error: ${e}`); } };
  // DDC/CI reads are slow-ish and some screens dislike polling: read once when details open
  useEffect(() => { if (visible && tab === "details") getScreens().then(setScr).catch(() => setScr(null)); }, [visible, tab]);
  useEffect(() => { if (!visible) return; refresh(); const t = setInterval(refresh, su?.busy ? 1000 : 3000); return () => clearInterval(t); }, [visible, su?.busy]);

  const gameUp = !!(s?.game_running || Router.MainRunningApp);
  const run = async (fn: () => Promise<Result>) => { setBusy(true); try { const r = await fn(); setMsg(r.message); } catch (e) { setMsg(`${e}`); } finally { setBusy(false); refresh(); } };

  const tel = s?.telemetry ?? {};
  const plMin = Number(tel["power.min_limit"] ?? 100), plMax = Number(tel["power.max_limit"] ?? 320);
  const plNow = pl ?? Math.round(Number(tel["power.limit"] ?? plMax));
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
  const driverMissing = !!(su?.slow_build && su.installed_version && su.helpers_present && su.driver_ready === false);
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
          <ButtonItem layout="below" onClick={() => setTab(tab === "main" ? "details" : tab === "details" ? "setup" : "main")}>{tab === "main" ? "Show details" : tab === "details" ? "Show setup & updates" : "Back to main"}</ButtonItem>
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
          {needsInstall && su && !su.busy && su.rc !== 0 && (
            <>
              <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{su.installed_version && !su.helpers_present ? "System files are missing (OS update)." : behind ? `Plugin ${su.payload_version} is in; its system files finish installing by themselves (after any running game is closed), or press Update system integration.` : driverMissing ? "The NVIDIA driver is not installed. Keep the eGPU unplugged." : su.installed_version ? "Setup is incomplete." : "Not installed yet."}</div></PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => installClick()}>{behind && su.helpers_present ? "Update system integration" : su.installed_version ? "Repair system integration" : "Install system integration"}</ButtonItem></PanelSectionRow>
            </>
          )}
          {updateReady && !su?.busy && <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>Version {up!.available} is available.</div></PanelSectionRow>}
          {updateReady && !su?.busy && <PanelSectionRow><ButtonItem layout="below" disabled={busy || gameUp} onClick={() => confirmInstall(`Update to ${up!.available}`, () => checkUpdate(true), () => updateDetached(up!.available))}>Update to {up!.available}</ButtonItem></PanelSectionRow>}
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ flex: "0 0 auto" }} dangerouslySetInnerHTML={{ __html: t.icon }} />
                  <div style={{ textAlign: "left" }}>Show Game Mode on {t.label}{t.xr && <span style={{ fontSize: "10px", background: "#1a9fff", borderRadius: "2px", padding: "0 4px", marginLeft: "6px" }}>XR</span>}
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
              <Row k="GPU" v={gpuName(tel["name"]) || (s.present ? s.bdf : "absent")} />
              <Row k="Driver" v={s.driver_loaded ? `nvidia ${tel["driver_version"] ?? ""}` : "not loaded"} />
              <Row k="PCIe" v={s.present ? `${s.link.speed} x${s.link.width}` : ""} />
              <Row k="Session" v={s.game_mode ? (s.on_egpu ? `Game Mode on ${screenName(s)}` : "Game Mode on panel") : "Desktop"} />
              {/* one row per screen: a joined list got cut off on the panel */}
              {(scr?.length ? scr : s.displays.map((d) => ({ connector: d.name, name: d.model, state: d.enabled ? "" : "off" }))).map((x) => (
                <Row key={x.connector} k={x.name || x.connector}
                  v={[screenState[x.state], x.connector.startsWith("HDMI") ? "HDMI" : x.connector.startsWith("DP") ? "DisplayPort" : x.connector].filter(Boolean).join(" · ")} />
              ))}
              {scr?.some((x) => x.ddc) && <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => run(async () => { const r = await wakeScreens(); getScreens().then(setScr).catch(() => {}); return r; })}>Wake screens</ButtonItem></PanelSectionRow>}
              <Row k="Audio" v={audioName(s.audio_sink, s.bdf)} />
              <Row k="Temp" v={tel["temperature.gpu"] ? `${tel["temperature.gpu"]} °C` : ""} />
              <Row k="Power" v={tel["power.draw"] ? `${Math.round(Number(tel["power.draw"]))} / ${Math.round(Number(tel["power.limit"]))} W` : ""} />
              <Row k="Core / mem" v={tel["clocks.gr"] ? `${tel["clocks.gr"]} / ${tel["clocks.mem"]} MHz` : ""} />
              <Row k="VRAM" v={tel["memory.used"] ? `${tel["memory.used"]} / ${tel["memory.total"]} MiB` : ""} />
              <Row k="Load" v={tel["utilization.gpu"] ? `${tel["utilization.gpu"]} %` : ""} />
              <Row k="Fan" v={tel["fan.speed"] && tel["fan.speed"] !== "[N/A]" ? `${tel["fan.speed"]} %` : ""} />
            </>
            )}
          </PanelSection>
          {!s.present ? null : controlsOk ? (
            <PanelSection title="Power controls">
              <PanelSectionRow>
                <SliderField label="Power limit (W)" value={plNow} min={plMin} max={plMax} step={5} showValue onChange={setPl} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy || pl === null} onClick={() => run(() => setPowerLimit(plNow))}>Apply power limit</ButtonItem></PanelSectionRow>
              <PanelSectionRow>
                <SliderField label="Core clock offset (MHz)" value={off} min={-300} max={300} step={15} showValue onChange={setOff} />
              </PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => run(() => setCoreOffset(off))}>Apply offset</ButtonItem></PanelSectionRow>
              <PanelSectionRow><ButtonItem layout="below" disabled={busy} onClick={() => { setOff(0); setPl(null); run(resetClocks); }}>Reset clocks</ButtonItem></PanelSectionRow>
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
          <PanelSectionRow><ToggleField label="Games use the screen's full resolution" description="On by default. Steam starts games at 1920x1080 on external screens, so a bigger one (XR glasses in ultrawide, 1440p, 4K) shows black bars. When a game starts, its Steam game resolution is set to the screen's own. Games you set yourself are left alone; switching this off leaves Steam as it is." checked={gr.enabled} onChange={(v) => run(async () => { const r = await setGameRes(v); setGr(await getGameRes()); return r; })} /></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && (
        <PanelSection title="Updates">
          <PanelSectionRow><ToggleField label="Automatic updates" description="Off (default): a new release is only announced here and you decide when to install it. On: it installs by itself when no game is running." checked={!!up?.auto_update} onChange={(v) => run(() => setAutoUpdate(v))} /></PanelSectionRow>
          <PanelSectionRow><ButtonItem layout="below" disabled={busy || !!su?.busy} onClick={() => run(() => checkUpdate(false))}>Check for updates now</ButtonItem></PanelSectionRow>
          <PanelSectionRow><div style={{ fontSize: "12px", opacity: 0.8 }}>{up ? (up.available ? `Available: ${up.available}` : (up.checked ? "Up to date." : "Not checked yet.")) + (up.last_error ? ` ${up.last_error}` : "") : "…"}</div></PanelSectionRow>
        </PanelSection>
      )}
      {tab === "setup" && (
        <PanelSection title="Extras (testing)">
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
  onDismount() { clearInterval(notices); launches?.unregister?.(); },
};
});
