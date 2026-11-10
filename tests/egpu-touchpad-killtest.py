#!/usr/bin/env python3
"""Kill-safety test for egpu-touchpad, isolated from the desktop. Run as root before releasing touchpad changes:
  sudo python3 tests/egpu-touchpad-killtest.py "$PWD/system/usr/local/sbin/egpu-touchpad"
A fake touchscreen feeds a real Pad; libinput (KDE) is told to ignore both test devices (a /run udev rule, removed at
the end), and the test aborts before any input if KDE sees them. Checks that BTN_LEFT is always released: kill -9 and
SIGTERM mid drag, the watchdog, a double-tap lock, and a real systemd service stopped mid drag."""
import fcntl, glob, os, signal, struct, subprocess, sys, time

TP = sys.argv[1]
RULE = "/run/udev/rules.d/99-egpu-touchpad-test.rules"
EV = struct.Struct("llHHi")
TS_NAME, PAD_NAME = "EGPU Buddy TEST touchscreen", "EGPU Buddy TEST touchpad"
results = []

def ok(name, cond):
    results.append((name, cond)); print(("PASS " if cond else "FAIL ") + name, flush=True)

def kwin_names():
    out = subprocess.run(["setpriv", "--reuid=1000", "--regid=1000", "--init-groups", "env",
                          "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus", "sh", "-c",
                          "for d in $(busctl --user tree org.kde.KWin | grep -o '/org/kde/KWin/InputDevice/event[0-9]*'); do "
                          "busctl --user get-property org.kde.KWin $d org.kde.KWin.InputDevice name; done"],
                         capture_output=True, text=True).stdout
    return out

def node(name):
    for d in glob.glob("/sys/class/input/event*/device/name"):
        if open(d).read().strip() == name:
            return "/dev/input/" + d.split("/")[4]

class FakeTS:
    def __init__(self):
        self.fd = os.open("/dev/uinput", os.O_WRONLY)
        io = lambda req, v: fcntl.ioctl(self.fd, req, v)
        for e in (0, 1, 3): io(0x40045564, e)
        io(0x40045565, 0x14A)
        io(0x4004556E, 1)   # INPUT_PROP_DIRECT
        for code, mx, res in ((0, 19200, 101), (1, 12000, 101), (0x35, 19200, 101), (0x36, 12000, 101), (0x2F, 9, 0), (0x39, 65535, 0)):
            io(0x40045567, code); io(0x401C5504, struct.pack("Hxx6i", code, 0, 0, mx, 0, 0, res))
        io(0x405C5503, struct.pack("4H80sI", 6, 0x1209, 0x7446, 1, TS_NAME.encode(), 0)); io(0x5501, 0)
        self.tid, self.down = 100, {}
    def e(self, t, c, v): os.write(self.fd, EV.pack(0, 0, t, c, v))
    def frame(self, pts):   # pts: {slot: (x, y)}; slots missing are lifted
        for s in list(self.down):
            if s not in pts:
                self.e(3, 0x2F, s); self.e(3, 0x39, -1); del self.down[s]
        for s, (x, y) in pts.items():
            self.e(3, 0x2F, s)
            if s not in self.down:
                self.tid += 1; self.down[s] = self.tid; self.e(3, 0x39, self.tid)
            self.e(3, 0x35, x); self.e(3, 0x36, y)
        if pts: self.e(0, 0, 0) if False else None
        self.e(1, 0x14A, 1 if pts else 0); self.e(0, 0, 0)
    def close(self): fcntl.ioctl(self.fd, 0x5502); os.close(self.fd)

PAD_PROG = """
import os, sys, time
ns = {"__name__": "tp"}; exec(open(sys.argv[1]).read(), ns)
pad = ns["Pad"](sys.argv[2], "test"); pad.three = sys.argv[3] == "three"
print("ready", flush=True)
while True:
    pad.pump(0.1); pad.watchdog(time.monotonic())
"""

class Listener:
    def __init__(self, path):
        self.fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK); self.ev, self.gone = [], False
    def drain(self, secs):
        end = time.monotonic() + secs
        while time.monotonic() < end:
            try:
                d = os.read(self.fd, EV.size * 64)
                for i in range(0, len(d), EV.size):
                    _, _, t, c, v = EV.unpack(d[i:i + EV.size]); self.ev.append((t, c, v))
            except BlockingIOError:
                time.sleep(0.02)
            except OSError:
                self.gone = True; return
    def btn(self):   # last BTN_LEFT state seen
        st = 0
        for t, c, v in self.ev:
            if t == 1 and c == 0x110: st = v
        return st

def start_pad(ts_path, mode):
    env = dict(os.environ, EGPU_TOUCHPAD_NAME=PAD_NAME)
    p = subprocess.Popen([sys.executable, "-c", PAD_PROG, TP, ts_path, mode], env=env, stdout=subprocess.PIPE, text=True)
    while True:
        line = p.stdout.readline()
        assert line, "pad exited before ready"
        print("  pad: " + line.strip(), flush=True)
        if line.strip() == "ready": break
    for _ in range(50):
        n = node(PAD_NAME)
        if n: break
        time.sleep(0.05)
    time.sleep(0.5)
    return p, Listener(n)

def three_drag(ts, lis):
    ts.frame({0: (5000, 5000), 1: (6000, 5000), 2: (7000, 5000)}); time.sleep(0.1)
    ts.frame({0: (5100, 5000), 1: (6100, 5000), 2: (7100, 5000)}); lis.drain(0.3)

def guardians_left(p):
    return subprocess.run(["pgrep", "-f", "EGPU_TOUCHPAD_NAME|" + PAD_NAME], capture_output=True).returncode == 0

def main():
    open(RULE, "w").write(f'SUBSYSTEM=="input", ATTRS{{name}}=="EGPU Buddy TEST*", ENV{{LIBINPUT_IGNORE_DEVICE}}="1"\n')
    subprocess.run(["udevadm", "control", "--reload"])
    ts = FakeTS(); time.sleep(1.5)
    ts_path = node(TS_NAME)
    try:
        if "TEST" in kwin_names():
            print("ABORT: KDE sees the test touchscreen"); return 2
        # A: kill -9 mid three-finger drag
        p, lis = start_pad(ts_path, "three")
        if "TEST" in kwin_names():
            print("ABORT: KDE sees the test touchpad"); p.kill(); return 2
        three_drag(ts, lis); ok("A: three-finger drag presses", lis.btn() == 1)
        os.kill(p.pid, signal.SIGKILL); lis.drain(1.5)
        ok("A: kill -9 mid drag: button released before the device goes", lis.btn() == 0)
        ok("A: device gone afterwards", lis.gone or node(PAD_NAME) is None)
        ts.frame({}); time.sleep(0.3)
        # G: real-hand drags: fingers land and lift a few ms apart, move between, in different orders
        p, lis = start_pad(ts_path, "three")
        for order in ((0, 1, 2), (2, 1, 0), (1, 0, 2)):
            ts.frame({0: (4000, 6000)}); time.sleep(0.008)
            ts.frame({0: (4010, 6000), 1: (5000, 6000)}); time.sleep(0.008)
            ts.frame({0: (4020, 6000), 1: (5010, 6000), 2: (6000, 6000)}); time.sleep(0.12)
            for k in range(1, 15):
                ts.frame({0: (4020 + 150 * k, 6000 + 40 * k), 1: (5010 + 150 * k, 6000 + 40 * k), 2: (6000 + 150 * k, 6000 + 40 * k)}); time.sleep(0.016)
            lis.drain(0.1); ok(f"G{order}: drag held while moving", lis.btn() == 1)
            pts = {s: (6200, 6560) for s in range(3)}
            for s in order:   # lift one at a time, 10 ms apart
                del pts[s]; ts.frame(dict(pts)); time.sleep(0.01)
            lis.drain(0.3); ok(f"G{order}: lifting one by one drops", lis.btn() == 0)
            ts.frame({0: (3000, 3000)}); time.sleep(0.05); ts.frame({0: (3500, 3000)}); time.sleep(0.05); ts.frame({}); lis.drain(0.3)
            ok(f"G{order}: next one-finger move does not press", lis.btn() == 0)
        os.kill(p.pid, signal.SIGTERM); lis.drain(1.0); ts.frame({}); time.sleep(0.3)
        # B: watchdog while running
        p, lis = start_pad(ts_path, "three")
        three_drag(ts, lis); ok("B: drag presses", lis.btn() == 1)
        lis.drain(2.0); ok("B: still drag held at 2 s", lis.btn() == 1)
        lis.drain(2.0); ok("B: watchdog released a still drag by 4 s", lis.btn() == 0)
        ts.frame({0: (5200, 5000), 1: (6200, 5000), 2: (7200, 5000)}); lis.drain(0.3)
        ok("B: fingers still down stay ignored", lis.btn() == 0)
        ts.frame({}); lis.drain(0.3)
        # C: SIGTERM mid drag
        three_drag(ts, lis); ok("C: drag presses again after lifting", lis.btn() == 1)
        os.kill(p.pid, signal.SIGTERM); lis.drain(1.5)
        ok("C: SIGTERM mid drag: button released", lis.btn() == 0)
        ts.frame({}); time.sleep(0.3)
        # D: double-tap lock, then kill -9
        p, lis = start_pad(ts_path, "tap")
        ts.frame({0: (5000, 5000)}); time.sleep(0.05); ts.frame({}); time.sleep(0.1)
        ts.frame({0: (5000, 5000)}); time.sleep(0.3); ts.frame({0: (5600, 5000)}); time.sleep(0.1); ts.frame({}); lis.drain(0.3)
        ok("D: double tap lock holds the button", lis.btn() == 1)
        os.kill(p.pid, signal.SIGKILL); lis.drain(1.5)
        ok("D: kill -9 while locked: button released", lis.btn() == 0)
        # E: SIGKILL of the whole group (pad and guardian at once, like a hard stop)
        p, lis = start_pad(ts_path, "three")
        three_drag(ts, lis)
        subprocess.run(["pkill", "-KILL", "-f", "exec\\(open\\(sys.argv\\[1\\]"]); lis.drain(1.5)
        print("INFO E: pad and guardian both killed -9 at once: kernel release " + ("seen" if lis.btn() == 0 else "NOT seen (cannot be guarded; the service never does this)"), flush=True)
        ts.frame({}); time.sleep(0.5)
        # F: the real stop path: a systemd service with the unit's default KillMode, stopped mid drag
        subprocess.run(["systemd-run", "--unit=egpu-touchpad-killtest", "-p", "TimeoutStopSec=5",
                        f"--setenv=EGPU_TOUCHPAD_NAME={PAD_NAME}", sys.executable, "-c", PAD_PROG, TP, ts_path, "three"],
                       capture_output=True)
        for _ in range(60):
            if node(PAD_NAME): break
            time.sleep(0.05)
        time.sleep(0.5); lis = Listener(node(PAD_NAME))
        three_drag(ts, lis); ok("F: service drag presses", lis.btn() == 1)
        subprocess.Popen(["systemctl", "stop", "egpu-touchpad-killtest"]); lis.drain(2.0)
        ok("F: systemctl stop mid drag: button released", lis.btn() == 0)
        ts.frame({}); time.sleep(0.5)
        ok("no guardian left running", subprocess.run(["pgrep", "-f", "exec\\(open\\(sys.argv\\[1\\]"], capture_output=True).returncode != 0)
    finally:
        subprocess.run(["pkill", "-KILL", "-f", "exec\\(open\\(sys.argv\\[1\\]"])
        subprocess.run(["systemctl", "stop", "egpu-touchpad-killtest"], capture_output=True)
        ts.close(); os.remove(RULE); subprocess.run(["udevadm", "control", "--reload"])
    bad = [n for n, c in results if not c]
    print("ALL PASS" if not bad else f"{len(bad)} FAILED"); return 1 if bad else 0

sys.exit(main())
