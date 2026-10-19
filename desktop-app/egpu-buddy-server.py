#!/usr/bin/env python3
"""EGPU Buddy desktop app backend: serves the page and a small JSON API over the shipped helpers.
No LACT, no other project. Runs as the user; privileged steps go through sudo -n (sudoers rule shipped)."""
import os, re, json, subprocess, http.server
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

_DOCK = [None, ""]   # [bdf it was looked up for, label]: egpu-detect is a script, not run on every poll

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
    return {"present": bool(bdf), "bdf": bdf, "vendor": vendor, "dock": _DOCK[1], "driver_loaded": driver, "tunnel": tunnel, "game_mode": game_mode,
            "gpu": gpu, "displays": displays, "panel_enabled": (panel[0] == "enabled") if panel else None,
            "detach": jread(f"{RUN}/safe-detach-status.json"),
            "update": jread("/run/nvegpu/update-status.json"), "installed": read("/etc/nv-egpu-buddy/version"), "gm": jread("/run/nvegpu/gm-status.json"), "last": dict(LAST), "show_seq": SHOW[0]}

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
        m = int((p or {}).get("mhz", 0)); rc, o, e = sh(["sudo", "-n", PRIV, "set-gpu-graphics-clock", str(m)], 20); return {"ok": rc == 0, "out": o or e}
    if a == "reset-clocks":
        rc, o, e = sh(["sudo", "-n", PRIV, "reset-gpu-clocks"], 20); return {"ok": rc == 0, "out": o or e}
    return {"ok": False, "error": f"unknown action {a}"}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=HERE, **k)
    def _json(self, o):
        d = json.dumps(o).encode(); self.send_response(200); self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(d))); self.send_header("cache-control", "no-store"); self.end_headers(); self.wfile.write(d)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/status": return self._json(status())
        return super().do_GET()
    def do_POST(self):
        p = self.path.split("?")[0]; n = int(self.headers.get("content-length", 0)); b = json.loads(self.rfile.read(n) or b"{}")
        if p == "/api/action": return self._json(action(b))
        self.send_error(404)
    def log_message(self, *a): pass
if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
