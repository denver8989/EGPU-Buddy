#!/usr/bin/env python3
"""EGPU Buddy desktop app backend: serves the page and a small JSON API over the shipped helpers.
No LACT, no other project. Runs as the user; privileged steps go through sudo -n (sudoers rule shipped)."""
import os, re, json, subprocess, http.server, time
HERE = os.path.dirname(os.path.abspath(__file__)); PORT = 8772
UID = os.getuid(); RUN = f"/run/user/{UID}/nv-egpu-buddy"
PRIV = "/usr/local/sbin/nv-egpu-buddy-privileged"
UI_DETACH = os.path.expanduser("~/.local/bin/egpu-safe-detach-ui")

def sh(cmd, t=6):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=t); return r.returncode, r.stdout.strip(), r.stderr.strip()
    except Exception as e:
        return 1, "", str(e)
def read(p):
    try: return open(p).read().strip()
    except OSError: return ""
def jread(p):
    try: return json.load(open(p))
    except Exception: return None

FIELDS = ("name,driver_version,temperature.gpu,power.draw,power.limit,power.min_limit,power.max_limit,clocks.gr,clocks.mem,"
          "memory.used,memory.total,utilization.gpu,pcie.link.gen.current,pcie.link.width.current,fan.speed,pstate,clocks.max.graphics")
# ASUS XG Mobile only: its laptop GPU reports power.limit as [N/A]; the cap it really runs at is enforced.power.limit
XG_FIELDS = ",enforced.power.limit,power.default_limit"
def sysfs_gpu(bdf):
    """Mesa-driver (AMD) telemetry under the nvidia-smi key names, so the page is shared. Experimental."""
    import glob
    dev = f"/sys/bus/pci/devices/{bdf}"; hw = (glob.glob(dev + "/hwmon/hwmon*") or [""])[0]
    def num(path, div):
        v = read(path); return f"{int(v) / div:.0f}" if v.lstrip("-").isdigit() else ""
    _, name, _ = sh(["lspci", "-D", "-s", bdf])
    g = {"name": name.split(": ", 1)[-1] if name else bdf, "driver_version": os.path.basename(os.path.realpath(dev + "/driver")),
         "temperature.gpu": num(hw + "/temp1_input", 1000), "power.draw": num(hw + "/power1_average", 1e6) or num(hw + "/power1_input", 1e6),
         "power.limit": num(hw + "/power1_cap", 1e6), "power.min_limit": num(hw + "/power1_cap_min", 1e6), "power.max_limit": num(hw + "/power1_cap_max", 1e6),
         "clocks.gr": num(hw + "/freq1_input", 1e6), "clocks.mem": num(hw + "/freq2_input", 1e6),
         "memory.used": num(dev + "/mem_info_vram_used", 1 << 20), "memory.total": num(dev + "/mem_info_vram_total", 1 << 20),
         "utilization.gpu": read(dev + "/gpu_busy_percent"), "fan.speed": num(hw + "/pwm1", 2.55)}
    return {k: v for k, v in g.items() if v}

def clock_limit(bdf):
    """The GPU clock limit set-gpu-graphics-clock applied (MHz), or 0. NVIDIA cannot read a clock lock back, so the helper
    keeps it in /run/nvegpu/clock-limit with the PCI device's birth (monotonic seconds): a GPU added again is a new device,
    born later, and has lost the lock."""
    try:
        b, m, born = open("/run/nvegpu/clock-limit").read().split()[:3]
        pm = f"/sys/bus/pci/devices/{bdf}/power/runtime_"
        age = (int(open(pm + "active_time").read()) + int(open(pm + "suspended_time").read())) / 1000
        return int(m) if b == bdf and abs(time.monotonic() - age - float(born)) < 5 else 0
    except (OSError, ValueError):
        return 0

def xgm_state():
    """ASUS XG Mobile: the settings egpu-xgm saved (fan mode and curve, lights, offsets, power target) and its power target loop's last
    reading ("live", only while it runs: written every second)."""
    s = jread("/var/lib/nvegpu/xgm.json") or {}; live = jread("/run/nvegpu/xgm-powercap.json") or {}
    return dict(s, fan=s.get("fan", "auto"), live=live if time.time() - (live.get("t") or 0) < 5 else {})

# the screen picker is for the NVIDIA reference path (SteamOS / CachyOS); Bazzite and the ROG Ally / XG Mobile route their
# desktops their own way and do not get it (looked up once: os-release and the device do not change while the app runs)
_REF = [None]
def ref_path():
    if _REF[0] is None:
        bz = "bazzite" in read("/etc/os-release").lower()
        ally = sh(["/usr/local/sbin/egpu-detect", "--device"])[1] == "rog-ally" or os.path.exists("/var/lib/nvegpu/xg-mobile-seen")
        _REF[0] = not bz and not ally
    return _REF[0]

_ALLY = [None]
def is_ally():
    """ROG Ally / ASUS XG Mobile (the CLAUDE.md gate), looked up once."""
    if _ALLY[0] is None:
        _ALLY[0] = sh(["/usr/local/sbin/egpu-detect", "--device"])[1] == "rog-ally" or os.path.exists("/var/lib/nvegpu/xg-mobile-seen")
    return _ALLY[0]

_DOCK = [None, ""]   # [bdf it was looked up for, label]: egpu-detect is a script, not run on every poll

# ---- look (new / classic), handheld picture ----
LOOK_FILE = os.path.expanduser("~/.config/nv-egpu-buddy/look")
def look():
    """The picked look wins. Unpicked: the new look on the NVIDIA reference path (SteamOS / CachyOS handhelds) only;
    Bazzite, ROG Ally / XG Mobile, AMD / Intel and NV GPU Buddy keep the classic look until someone picks the new one."""
    v = read(LOOK_FILE)
    if v in ("classic", "new"): return v
    other = (not ref_path()) or read("/etc/nv-egpu-buddy/track") == "nv-gpu-buddy" or read("/etc/nv-egpu-buddy/gpu-vendor") == "amd"
    return "classic" if other else "new"

# DMI "vendor product family" -> handhelds/<file>.svg (the same table as the Game Mode plugin, same pictures)
HANDHELD_ART = [
    (r"Legion Go S", "lenovo-legion-go-s", "Lenovo Legion Go S"), (r"Legion Go (2|8A.P2)", "lenovo-legion-go-2", "Lenovo Legion Go 2"), (r"Legion Go", "lenovo-legion-go", "Lenovo Legion Go"),
    (r"RC73|Xbox Ally", "asus-rog-xbox-ally", "ROG Xbox Ally"), (r"RC71|RC72|ROG Ally", "asus-rog-ally", "ASUS ROG Ally"),
    (r"Claw A8", "msi-claw-a8", "MSI Claw A8"), (r"Claw", "msi-claw", "MSI Claw"),
    (r"AYANEO.*SLIDE", "ayaneo-slide", "AYANEO Slide"), (r"AYANEO.*KUN", "ayaneo-kun", "AYANEO KUN"), (r"AYANEO.*NEXT", "ayaneo-next", "AYANEO NEXT"),
    (r"AYANEO.*AIR", "ayaneo-air", "AYANEO AIR"), (r"AYANEO 3\b", "ayaneo-3", "AYANEO 3"), (r"AYANEO 2", "ayaneo-2", "AYANEO 2"), (r"AYA ?NEO.*(NEO|FOUNDER|2021)", "ayaneo-neo", "AYANEO"),
    (r"Loki", "ayn-loki", "AYN Loki"), (r"G1618-03", "gpd-win-3", "GPD WIN 3"), (r"G1618-04", "gpd-win-4", "GPD WIN 4"), (r"G1617", "gpd-win-mini", "GPD WIN Mini"), (r"G1619", "gpd-win-max-2", "GPD WIN Max 2"),
    (r"ONEXPLAYER F1", "onexplayer-f1", "ONEXPLAYER F1"), (r"ONEXPLAYER G1", "onexplayer-g1", "ONEXPLAYER G1"), (r"ONEXPLAYER X1", "onexplayer-x1", "ONEXPLAYER X1"), (r"ONEXPLAYER 2", "onexplayer-2", "ONEXPLAYER 2"),
    (r"AOKZOE A1", "aokzoe-a1", "AOKZOE A1"), (r"Win600", "anbernic-win600", "Anbernic Win600"), (r"ZOTAC.*ZONE", "zotac-zone", "ZOTAC ZONE"),
    (r"Pocket Go", "tecno-pocket-go", "TECNO Pocket Go"), (r"Zeenix", "tectoy-zeenix", "Tectoy Zeenix"),
]

def handheld_art():
    """(name, svg path) of this handheld's outline, or ("", "") when none is known."""
    dmi = " ".join(read(f"/sys/class/dmi/id/{k}") for k in ("sys_vendor", "product_name", "product_family"))
    name, title = next(((f, t) for rx, f, t in HANDHELD_ART if re.search(rx, dmi, re.I)), ("", ""))
    for d in (os.path.join(os.path.dirname(os.path.abspath(__file__)), "handhelds"), os.path.join(os.path.expanduser("~"), "homebrew/plugins/EGPU-Buddy/handhelds")):
        if name and os.path.exists(f"{d}/{name}.svg"): return title, f"{d}/{name}.svg"
    return "", ""

def handheld_svg():
    """The outline in the app's line colour, sized by the window (the plugin recolours the same files)."""
    _, path = handheld_art()
    if not path: return b""
    svg = open(path, errors="ignore").read(); svg = svg[svg.index("<svg"):]
    svg = re.sub(r"((?:stroke|fill)\s*[=:]\s*\"?)#[0-9a-fA-F]{3,8}", r"\g<1>#c9c5ea", svg)
    svg = re.sub(r'<svg\b([^>]*?)\s(?:width|height)="[^"]*"', r"<svg\1", svg, count=2)
    svg = re.sub(r'stroke-width="[^"]*"', 'stroke-width="1.15"', svg)   # the file's 0.2-unit strokes drew ~0.3 px lines: faint and broken
    return svg.encode()

# ---- Extras: the Game Mode plugin's own settings file, so the app and the plugin always agree ----
PLUGIN_SETTINGS = os.path.expanduser("~/.config/egpu-buddy/plugin.json")
SCREEN_NET = "/var/lib/nvegpu/screen-net.json"
STEAM_FIX = os.path.expanduser("~/.local/bin/egpu-steam-ui-fix")
def plugin_settings():
    try: return json.load(open(PLUGIN_SETTINGS))
    except Exception: return {}
def save_plugin_settings(d):
    os.makedirs(os.path.dirname(PLUGIN_SETTINGS), exist_ok=True); json.dump(d, open(PLUGIN_SETTINGS, "w"))
def extras_on():
    """The Game Mode settings the app shows: the NVIDIA reference path and NV GPU Buddy (the plugin has them there too); Bazzite,
    ROG Ally / XG Mobile and AMD / Intel keep the plugin as the one place."""
    return ref_path() and read("/etc/nv-egpu-buddy/gpu-vendor") != "amd"
def usb4():
    """The eGPU's USB4 / Thunderbolt link as the kernel reports it (the plugin's reading)."""
    import glob
    for dev in sorted(glob.glob("/sys/bus/thunderbolt/devices/*-*")):
        if re.search(r"-0$|:", os.path.basename(dev)) or not read(dev + "/device_name"): continue
        per = float((re.findall(r"[\d.]+", read(dev + "/rx_speed")) or ["0"])[0]); lanes = int(read(dev + "/rx_lanes") or "0")
        return {"name": " ".join(x for x in (read(dev + "/vendor_name"), read(dev + "/device_name")) if x), "per_lane": per, "lanes": lanes, "total": per * lanes, "slow": lanes < 2 or per < 20}
    return {}
def tv_remote():
    """TV controls / TV off at Safe Detach (opt-in; egpu-screen, the plugin's reading): every setup, as in the plugin."""
    try: return json.loads(sh(["/usr/local/sbin/egpu-screen", "tvremote"], 20)[1])
    except ValueError: return {}
def extras():
    net = jread(SCREEN_NET) or {}
    tv = {"enabled": bool(net.get("enabled")), "paired": [f'{t["ip"]} on {t["input"].replace("_", " ")}' for t in (net.get("tvs") or {}).values()]}
    if not extras_on(): return {"tv_any": tv, "tvr": tv_remote()}   # the TV card only (the rest stays in the plugin there)
    d = plugin_settings(); fix = {}
    if os.path.exists(STEAM_FIX):
        try: fix = json.loads(sh([STEAM_FIX, "status"], 10)[1])
        except ValueError: fix = {}
    on = bool(d.get("addons", {}).get("usb4"))
    return {"auto_update": bool(d.get("auto_update", False)), "game_res": bool(d.get("game_res_native", True)),
            "steam_fix": {"available": bool(fix.get("available")), "enabled": bool(fix.get("enabled"))},
            "usb4_on": on, "usb4": usb4() if on else {},
            "tv": tv, "tv_any": tv, "tvr": tv_remote()}

def status():
    _, l, _ = sh(["lspci", "-Dn"]); bdf = next((x.split()[0] for x in l.splitlines() if " 0300: 10de:" in x), ""); vendor = "nvidia" if bdf else ""
    if not bdf:
        rc, o, _ = sh(["/usr/local/sbin/egpu-detect"]); o = o.split()
        if rc == 0 and len(o) >= 2 and o[1] != "nvidia": bdf, vendor = o[0], o[1]
    driver = os.path.exists("/sys/module/nvidia_drm") if vendor in ("", "nvidia") else os.path.exists(f"/sys/bus/pci/devices/{bdf}/driver")
    gpu = sysfs_gpu(bdf) if (bdf and driver and vendor != "nvidia") else {}
    # the dock, when the GPU name alone does not say what it is ("RTX 5070 Ti Laptop GPU" is an ASUS XG Mobile)
    if _DOCK[0] != bdf: _DOCK[:] = [bdf, "ASUS ROG XG Mobile" if bdf and sh(["/usr/local/sbin/egpu-detect", "--dock"])[1].startswith("xg-mobile") else ""]
    if bdf and driver and vendor == "nvidia":
        f = FIELDS + (XG_FIELDS if _DOCK[1] else "")
        rc, out, _ = sh(["timeout", "6", "nvidia-smi", "-i", bdf, f"--query-gpu={f}", "--format=csv,noheader,nounits"], 8)
        if rc == 0 and out: gpu = dict(zip(f.split(","), [v.strip() for v in out.split(",")]))
        if gpu and _DOCK[1]: gpu["clock_limit"] = clock_limit(bdf)
    xgm = xgm_state() if _DOCK[1] else {}
    _, bolt, _ = sh(["boltctl", "list"]); tunnel = "authorized" in bolt.lower()
    game_mode = sh(["pgrep", "-x", "gamescope(-wl)?"])[0] == 0
    displays = []
    if bdf:
        base = f"/sys/bus/pci/devices/{bdf}/drm"
        for card in (os.listdir(base) if os.path.isdir(base) else []):
            if re.match(r"card\d+$", card):
                for c in os.listdir("/sys/class/drm"):
                    if c.startswith(card + "-") and read(f"/sys/class/drm/{c}/status") == "connected":
                        displays.append({"name": c.split("-", 1)[1], "enabled": read(f"/sys/class/drm/{c}/enabled") == "enabled"})
    panel = [read(p + "/enabled") for p in __import__("glob").glob("/sys/class/drm/card*-eDP-1")]
    return {"present": bool(bdf), "bdf": bdf, "vendor": vendor, "dock": _DOCK[1], "xgm": xgm, "driver_loaded": driver, "tunnel": tunnel, "game_mode": game_mode,
            "gpu": gpu, "displays": displays, "panel_enabled": (panel[0] == "enabled") if panel else None,
            "detach": jread(f"{RUN}/safe-detach-status.json"),
            "update": jread("/run/nvegpu/update-status.json"), "installed": read("/etc/nv-egpu-buddy/version"), "gm": jread("/run/nvegpu/gm-status.json"), "last": dict(LAST), "show_seq": SHOW[0],
            # NV GPU Buddy track (experimental, built-in NVIDIA card): the window shows its name and hides the eGPU parts
            "track": "nv-gpu-buddy" if read("/etc/nv-egpu-buddy/track") == "nv-gpu-buddy" else "", "look": look(), "handheld": handheld_art()[0],
            **update_state(read("/etc/nv-egpu-buddy/version")), **(screens(bdf if driver else "") if vendor in ("", "nvidia") and ref_path() else {}),
            # ROG Ally / XG Mobile: the screen Game Mode starts on (the plugin's "Show Game Mode on"); its desktop keeps its own screens
            **({**screens(bdf if driver else ""), "screens_game_only": True} if vendor in ("", "nvidia") and not ref_path() and is_ally() else {})}

def edid_name(conn_dir):
    try: e = open(conn_dir + "/edid", "rb").read()[:128]
    except OSError: return ""
    i = e.find(b"\0\0\0\xfc\0")
    return e[i + 5:i + 18].split(b"\n")[0].decode(errors="ignore").strip() if i >= 0 else ""

def best_mode(conn_dir):
    """The mode that says what the screen is: the largest one in the widest shape it lists (a 32:9 monitor lists 16:9 modes too)."""
    ms = [tuple(map(int, m.split("x"))) for m in read(conn_dir + "/modes").splitlines() if re.fullmatch(r"\d+x\d+", m)]
    shape = lambda m: 2 if m[0] / m[1] >= 3.2 else 1 if m[0] / m[1] >= 2.2 else 0
    best = max(ms, key=lambda m: (shape(m), m[0] * m[1]), default=None)
    return "%dx%d" % best if best else ""

def edid_inch(conn_dir):
    """Screen diagonal in inches from the EDID's size in cm (0 when it does not say)."""
    try: e = open(conn_dir + "/edid", "rb").read()[:128]; return round((e[21] ** 2 + e[22] ** 2) ** 0.5 / 2.54) if e[21] and e[22] else 0
    except (OSError, IndexError): return 0

def screens(bdf):
    """NVIDIA install: the screens the desktop (and Game Mode) can be put on, as in the plugin: the handheld's own screen, a
    screen on the handheld's USB-C port (XR glasses), the eGPU's monitors. "desktop_on": where KWin runs now."""
    import glob
    out = []; ecard = ""
    pnl = (glob.glob("/sys/class/drm/card*-eDP-*") or [""])[0]; pcard = os.path.basename(pnl).split("-")[0] if pnl else ""
    if bdf:
        ecard = next((c for c in os.listdir(f"/sys/bus/pci/devices/{bdf}/drm") if re.match(r"card\d+$", c)), "") if os.path.isdir(f"/sys/bus/pci/devices/{bdf}/drm") else ""
    for d in sorted(glob.glob("/sys/class/drm/card*-*")):
        card, conn = os.path.basename(d).split("-", 1)
        if read(d + "/status") != "connected" or conn.startswith("Writeback"): continue
        if card == pcard:
            out.append({"name": conn, "kind": "handheld", "label": "Handheld screen" if conn.startswith("eDP") else (edid_name(d) or conn) + " (USB-C)", "mode": best_mode(d), "port": conn.split("-")[0], "inch": edid_inch(d)})
        elif card == ecard and not conn.startswith("eDP"):
            out.append({"name": conn, "kind": "egpu", "label": edid_name(d) or conn, "mode": best_mode(d), "port": conn.split("-")[0], "inch": edid_inch(d)})
    out.sort(key=lambda x: x["kind"] != "handheld")
    on = ""
    _, k, _ = sh(["pgrep", "-u", str(UID), "-x", "kwin_wayland"])
    if k:
        try: env = dict(l.split("=", 1) for l in open(f"/proc/{k.split()[0]}/environ").read().split("\0") if "=" in l)
        except OSError: env = {}
        dev = env.get("KWIN_DRM_DEVICES", "")
        if not dev:   # kwin_wayland has cap_sys_nice, so its environ is unreadable to us: read what the session started it with
            _, o, _ = sh(["systemctl", "--user", "show-environment"])
            dev = next((l.split("=", 1)[1] for l in o.splitlines() if l.startswith("KWIN_DRM_DEVICES=")), "")
        on = "egpu" if ecard and f"/dev/dri/{ecard}" in dev.split(":")[:1] else ("handheld" if dev else "")
    return {"screens": out, "screen_pick": read("/var/lib/nvegpu/game-screen"), "desktop_on": on}

def update_state(installed):
    """For the Update button (GitHub issue #5): the newest release (from the release-notes cache, refreshed in the
    background so the status never waits on GitHub) and a staged update (a newer payload that installs at the next boot)."""
    if time.time() - _NOTES.get("try", 0) > 600:
        import threading
        _NOTES["try"] = time.time(); threading.Thread(target=release_notes, daemon=True).start()
    vs = [r["version"] for r in track_rels(_NOTES["rels"])]
    latest = max(vs, key=vt) if vs else ""
    pv = read(os.path.expanduser("~/.local/share/steamos-egpu-buddy/VERSION"))
    return {"latest": latest, "staged": pv if pv and installed and vt(pv) > vt(installed) else ""}

# Long actions run in the background, but their RESULT is kept and shown by the page: a button that fails must say so
# (Re-attach used to discard all output, so a refused attach looked like a dead button).
LAST = {}
SHOW = [0]   # bumped by the launcher when the app is opened again while it already runs (window hidden in the tray)
# Detach and attach restart the compositor, which takes the tray (a Wayland client) down with it, and systemd then
# kills everything in the tray's service. Run them in their own unit so they finish anyway.
OWN_UNIT = ["systemd-run", "--user", "--collect", "--quiet"]
def run_bg(name, cmd, timeout=300):
    import threading
    def work():
        LAST.update(action=name, state="running", rc=None, out="")
        rc, o, e = sh(OWN_UNIT + ["--wait", "--pipe"] + cmd, timeout)
        LAST.update(state="ok" if rc == 0 else "failed", rc=rc, out="\n".join((o + "\n" + e).strip().splitlines()[-6:]))
    threading.Thread(target=work, daemon=True).start()


def action(p):
    a = (p or {}).get("action")
    if a == "show": SHOW[0] += 1; return {"ok": True}
    s = status()
    if s.get("track") and a in ("safe-detach", "attach", "set-screen", "xgm-intro-seen"):   # NV GPU Buddy: eGPU-only actions
        return {"ok": False, "error": "not available in NV GPU Buddy mode"}
    if a == "safe-detach":
        if not s["present"]: return {"ok": False, "error": "no eGPU on the bus"}
        if s["vendor"] != "nvidia":
            subprocess.Popen(OWN_UNIT + ["sudo", "-n", "/usr/local/sbin/egpu-generic", "detach"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True); return {"ok": True, "started": "safe-detach"}
        if s["game_mode"]: rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-gamemode-detach"], 120); return {"ok": rc == 0, "out": o or e}
        if not os.access(UI_DETACH, os.X_OK): return {"ok": False, "error": "egpu-safe-detach-ui is not installed"}
        subprocess.Popen(OWN_UNIT + [UI_DETACH], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True); return {"ok": True, "started": "safe-detach"}
    if a == "attach":
        if s["present"] and s["driver_loaded"]: return {"ok": False, "error": "already attached"}
        run_bg("attach", ["sudo", "-n", "/usr/local/sbin/egpu-reattach"]); return {"ok": True, "started": "attach"}
    if a == "update":   # system integration + Decky plugin to the latest release; its own unit: it restarts this app at the end
        if (jread("/run/nvegpu/update-status.json") or {}).get("state") == "running": return {"ok": True, "started": "update"}
        subprocess.Popen(OWN_UNIT + ["--unit=egpu-buddy-update", "sudo", "-n", "/usr/local/sbin/egpu-buddy-update"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return {"ok": True, "started": "update"}
    if a == "power-limit":
        w = int((p or {}).get("watts", 0)); rc, o, e = sh(["sudo", "-n", PRIV, "set-gpu-power-limit" if s["vendor"] in ("", "nvidia") else "set-generic-power-cap", str(w)], 20); return {"ok": rc == 0, "out": o or e}
    if a == "clock-limit":   # laptop-class GPUs (ASUS XG Mobile): no power limit from the driver, a clock limit instead
        m = int((p or {}).get("mhz", 0)); rc, o, e = sh(["sudo", "-n", PRIV, "set-gpu-graphics-clock", str(m)], 20)
        return {"ok": rc == 0, "out": (f"GPU clock limited to {m} MHz" if rc == 0 else o or e)}   # not nvidia-smi's persistence-mode warning
    if a in ("xgm-fan", "xgm-fan-curve", "xgm-light", "xgm-light-effect", "xgm-brightness", "xgm-offset", "xgm-power"):   # ASUS XG Mobile (the helper refuses any other dock)
        arg = str((p or {}).get("value", "")); rc, o, e = sh(["sudo", "-n", PRIV, {"xgm-power": "xgm-power-target"}.get(a, a), arg], 20)
        return {"ok": rc == 0, "out": o or e}
    if a == "set-look":   # the app's look: new (default) or classic (the one before); kept per user
        v = "classic" if str((p or {}).get("value", "")) == "classic" else "new"
        os.makedirs(os.path.dirname(LOOK_FILE), exist_ok=True); open(LOOK_FILE, "w").write(v + "\n"); return {"ok": True, "out": "Look: " + v, "silent": True}
    if a == "tv-option":   # "TV remote (CEC)" / "Turn the TV off at Safe Detach" (opt-in, every setup, as in the plugin)
        k = str((p or {}).get("key", ""))
        if k not in ("cec_remote", "off_at_detach", "nvidia_dp_cec"): return {"ok": False, "error": "unknown setting"}
        rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "tvset", k, "on" if (p or {}).get("value") else "off"], 15); return {"ok": rc == 0, "out": o or e, "silent": rc == 0}
    if a == "tv-key":   # TV controls: volume / mute (CEC through SteamOS's cecd, or a paired LG TV); runs as the user
        k = str((p or {}).get("key", ""))
        if k not in ("up", "down", "mute", "on", "off", "input"): return {"ok": False, "error": "unknown key"}
        rc, o, e = sh(["/usr/local/sbin/egpu-screen", "tvkey", k], 25); o = o.strip(); return {"ok": o.startswith("ok"), "out": o or e, "silent": o.startswith("ok")}
    if a in ("tv-control", "pair-tv") and not extras_on():   # TV control tricks: every setup, as in the plugin
        if a == "tv-control":
            rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "tvctl", "on" if (p or {}).get("value") else "off"], 15); return {"ok": rc == 0, "out": o or e}
        ips = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "find"], 30)[1].split()
        hdmi = [x["name"] for x in s.get("screens", []) if x["name"].startswith("HDMI")] or [x["name"] for x in s.get("displays", []) if x.get("name", "").startswith("HDMI")]
        if not ips: return {"ok": False, "out": "No LG TV found on the network. Turn the TV on, on the same network as this device."}
        if len(hdmi) != 1: return {"ok": False, "out": "Connect the TV to the eGPU's HDMI port first." if not hdmi else "More than one HDMI screen: unplug the others while pairing."}
        rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "pair", ips[0], hdmi[0]], 90)
        return {"ok": o.startswith("paired"), "out": o or e or "No answer from the TV."}
    if a in ("set-extra", "steam-fix", "tv-control", "wake-screens", "pair-tv"):   # Game Mode settings in the app (NVIDIA reference path)
        if not extras_on(): return {"ok": False, "error": "these settings are in the Game Mode plugin on this setup"}
        v = (p or {}).get("value")
        if a == "set-extra":
            k = str((p or {}).get("key", "")); d = plugin_settings()
            if k in ("auto_update", "game_res_native"): d[k] = bool(v)
            elif k == "usb4": d.setdefault("addons", {})["usb4"] = bool(v)
            else: return {"ok": False, "error": "unknown setting"}
            save_plugin_settings(d); return {"ok": True, "out": "Saved.", "silent": True}
        if a == "steam-fix":
            rc, o, e = sh([STEAM_FIX, "on" if v else "off"], 20)
            return {"ok": rc == 0, "out": ("Steam menu fix " + ("on" if v else "off") + ". It applies when Game Mode restarts.") if rc == 0 else (e or o or "could not change it")}
        if a == "tv-control":
            rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "tvctl", "on" if v else "off"], 15); return {"ok": rc == 0, "out": o or e}
        if a == "wake-screens":
            rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "wake", "--input"], 30); return {"ok": rc == 0, "out": o.replace("\n", "; ") or e or "No external screens connected."}
        if a == "pair-tv":
            ips = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "find"], 30)[1].split()
            hdmi = [x["name"] for x in s.get("screens", []) if x["name"].startswith("HDMI")]
            if not ips: return {"ok": False, "out": "No LG TV found on the network. Turn the TV on, on the same network as this device."}
            if len(hdmi) != 1: return {"ok": False, "out": "Connect the TV to the eGPU's HDMI port first." if not hdmi else "More than one HDMI screen: unplug the others while pairing."}
            rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-screen", "pair", ips[0], hdmi[0]], 90)
            return {"ok": o.startswith("paired"), "out": o or e or "No answer from the TV."}
    if a == "check-update":   # Check for updates: ask GitHub now instead of waiting for the 10-minute refresh
        _NOTES["t"] = 0; _NOTES["try"] = time.time(); release_notes(); st = update_state(s.get("installed", ""))
        newer = st["latest"] and s.get("installed") and vt(st["latest"]) > vt(s["installed"])
        return {"ok": True, "out": ("Update available: " + st["latest"]) if newer else ("Up to date (" + (s.get("installed") or "?") + ")"), "silent": True}
    if a == "report":   # Save support report (the same file as the "Save EGPU Buddy report" icon)
        rc, o, e = sh(["sudo", "-n", "/usr/local/sbin/egpu-report"], 90); return {"ok": rc == 0, "out": ("Support report saved: " + o.strip()) if rc == 0 else (o or e)}
    if a == "xgm-intro-seen":   # the XG Mobile intro animation was shown in this app (it plays once here, once in the plugin)
        rc, o, e = sh(["sudo", "-n", PRIV, "xgm-intro-seen", "desktop"], 10); return {"ok": rc == 0, "silent": True}
    if a == "set-screen":   # NVIDIA install: the screen for the desktop and Game Mode (the plugin's "Show Game Mode on ...")
        c = str((p or {}).get("connector", ""))
        if s["vendor"] not in ("", "nvidia") or "screens" not in s: return {"ok": False, "error": "screen choice is for the NVIDIA install on SteamOS / CachyOS"}
        pick = next((x for x in s.get("screens", []) if x["name"] == c), None)
        if not pick: return {"ok": False, "error": f"{c} is not a connected screen"}
        rc, o, e = sh(["sudo", "-n", PRIV, "set-game-screen", c], 10)
        if rc != 0: return {"ok": False, "out": o or e}
        if s.get("screens_game_only"):   # ROG Ally / XG Mobile: Game Mode only, the desktop is left as it is
            return {"ok": True, "out": f"{pick['label']} picked: Game Mode starts on it next time. The desktop keeps its screens."}
        if s["game_mode"]: return {"ok": True, "out": f"{pick['label']} picked: Game Mode uses it at its next start."}
        if not (s["present"] and s["driver_loaded"]):
            return {"ok": True, "out": f"{pick['label']} picked: the desktop and Game Mode use it once the eGPU is attached."}
        if pick["kind"] == s.get("desktop_on"):
            # same GPU as now: the picked screen alone shows an image (owner's rule), every other screen KWin drives goes off
            sh(["/usr/local/sbin/egpu-screen", "only", c], 30)
            return {"ok": True, "out": f"The desktop is on {pick['label']} only."}
        # the other GPU: KWin re-starts on it (one GPU at a time: no crosstalk); the login comes back to the desktop
        sh(["sudo", "-n", PRIV, "session-fallback", "desktop"], 10)
        subprocess.Popen(OWN_UNIT + ["/bin/sh", "-c", "sleep 2; qdbus6 org.kde.Shutdown /Shutdown org.kde.Shutdown.logout || qdbus org.kde.Shutdown /Shutdown org.kde.Shutdown.logout"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return {"ok": True, "out": f"The desktop restarts on {pick['label']} (a few seconds)."}
    if a == "nvidia-set":   # NVIDIA settings (experimental): save; games started afterwards on the eGPU get them
        if s["vendor"] not in ("", "nvidia"): return {"ok": False, "error": "NVIDIA settings are for the NVIDIA install"}
        rc, o, e = sh([NVT, "set", json.dumps((p or {}).get("settings") or {})], 20)
        try: r = json.loads(o)
        except ValueError: r = {"ok": False, "message": e or o}
        return {"ok": bool(r.get("ok")), "out": ("Saved: games get them at their next launch." if nvidia_settings().get("loader") == "loaded" else "Saved. Restart Steam once (button below) for games to get them.") if r.get("ok") else r.get("message")}
    if a == "proton-install":
        rc, o, e = sh([NVT, "proton-install"], 20)
        try: r = json.loads(o)
        except ValueError: r = {"ok": False, "message": e or o}
        return {"ok": bool(r.get("ok")), "out": r.get("message")}
    if a == "nvidia-off":
        rc, o, e = sh([NVT, "off"], 20)
        try: r = json.loads(o)
        except ValueError: r = {"ok": False, "message": e or o}
        return {"ok": bool(r.get("ok")), "out": r.get("message")}
    if a == "nvidia-restart-steam":
        if s["game_mode"]: return {"ok": False, "error": "in Game Mode the plugin applies them (it restarts Game Mode)"}
        rc, o, e = sh([NVT, "restart-steam"], 60)
        try: r = json.loads(o)
        except ValueError: r = {"ok": False, "message": e or o}
        return {"ok": bool(r.get("ok")), "out": r.get("message")}
    if a == "reset-clocks":
        rc, o, e = sh(["sudo", "-n", PRIV, "reset-gpu-clocks"], 20); return {"ok": rc == 0, "out": o or e}
    return {"ok": False, "error": f"unknown action {a}"}

# NVIDIA settings (experimental): egpu-nvidia-tweaks keeps them; the desktop app only shows and changes them
NVT = os.path.expanduser("~/.local/bin/egpu-nvidia-tweaks")
def nvidia_settings():
    rc, o, e = sh([NVT, "get"], 20)
    try: d = json.loads(o)
    except ValueError: return {"error": e or "the NVIDIA settings could not be read"}
    try: d["proton"] = json.loads(sh([NVT, "proton-status"], 20)[1])
    except ValueError: d["proton"] = {}
    return d

REPO = "denver8989/EGPU-Buddy"
_NOTES = {"t": 0.0, "rels": []}
def vt(v): return tuple(int(x) for x in re.findall(r"\d+", v or "0")[:3]) or (0,)
def track_rels(rels):
    """NV GPU Buddy track: only the releases marked for it ("NV GPU Buddy:" in the notes); eGPU installs: every release."""
    return [r for r in rels if "NV GPU Buddy:" in r["body"]] if read("/etc/nv-egpu-buddy/track") == "nv-gpu-buddy" else rels

def release_notes():
    """The release notes from GitHub: every release newer than the installed one (what an update brings), newest first;
    with nothing newer, the installed release's own notes. Each GitHub release carries only its own changes. Cached 10 min."""
    installed = read("/etc/nv-egpu-buddy/version")
    try:
        if time.time() - _NOTES["t"] > 600:
            import urllib.request
            req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/releases?per_page=30", headers={"User-Agent": "EGPU-Buddy"})
            data = json.load(urllib.request.urlopen(req, timeout=20))
            _NOTES.update(t=time.time(), rels=[{"version": r.get("tag_name", "").lstrip("v"), "date": (r.get("published_at") or "")[:10],
                                                "body": r.get("body") or "", "url": r.get("html_url", "")}
                                               for r in data if not r.get("draft") and not r.get("prerelease")])
    except Exception as ex:
        if not _NOTES["rels"]: return {"title": "Release notes", "notes": [], "error": f"Could not reach GitHub: {ex}"}
    rels = track_rels(_NOTES["rels"])
    newer = [r for r in rels if vt(r["version"]) > vt(installed)]
    if newer: return {"title": f"What's new since {installed}" if installed else "Release notes", "notes": newer}
    return {"title": f"What's new in {installed}", "notes": [r for r in rels if r["version"] == installed][:1]}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=HERE, **k)
    def _json(self, o):
        d = json.dumps(o).encode(); self.send_response(200); self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(d))); self.send_header("cache-control", "no-store"); self.end_headers(); self.wfile.write(d)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/status": return self._json(status())
        if p == "/handheld.svg":
            b = handheld_svg()
            self.send_response(200 if b else 404); self.send_header("content-type", "image/svg+xml"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        if p == "/api/extras": return self._json(extras())
        if p == "/api/notes": return self._json(release_notes())
        if p == "/api/nvidia": return self._json(nvidia_settings())
        if p == "/api/nvidia-game":   # while a game runs: which saved setting it really received (read-only)
            try: return self._json(json.loads(sh([NVT, "game-status"], 20)[1]))
            except ValueError: return self._json({"running": False})
        return super().do_GET()
    def do_POST(self):
        p = self.path.split("?")[0]; n = int(self.headers.get("content-length", 0)); b = json.loads(self.rfile.read(n) or b"{}")
        if p == "/api/action": return self._json(action(b))
        self.send_error(404)
    def log_message(self, *a): pass
if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
