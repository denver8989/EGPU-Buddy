#!/usr/bin/env python3
"""What libinput (the layer KDE and gamescope read) makes of egpu-touchpad's virtual touchpad. Run as root:
  sudo python3 tests/egpu-touchpad-libinput-test.py "$PWD/system/usr/local/sbin/egpu-touchpad"
The test devices are put on their own udev seat (KDE reads seat0 only), and the test aborts if KDE sees them.
A libinput context of our own (tapping off, as egpu-touchpad sets in KDE) reads the virtual touchpad; checks that every
pointer button press is matched by a release and the seat button count returns to 0, in real-hand three-finger drags,
double-tap drags and when the touchpad dies mid drag."""
import ctypes, ctypes.util, os, select, signal, subprocess, sys, time

TP = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
kt = {"__name__": "kt"}
src = open(os.path.join(HERE, "egpu-touchpad-killtest.py")).read().replace("\nsys.exit(main())", "\n")
sys.argv = [sys.argv[0], TP]
exec(src, kt)
kt["RULE"] = "/run/udev/rules.d/99-egpu-touchpad-libinput-test.rules"

li = ctypes.CDLL(ctypes.util.find_library("input"))
libc = ctypes.CDLL(None, use_errno=True)
OPEN = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_void_p)
CLOSE = ctypes.CFUNCTYPE(None, ctypes.c_int, ctypes.c_void_p)
class Iface(ctypes.Structure):
    _fields_ = [("open_restricted", OPEN), ("close_restricted", CLOSE)]
def _open(path, flags, _):
    try: return os.open(path, flags)
    except OSError as e: return -e.errno
def _close(fd, _): os.close(fd)
IFACE = Iface(OPEN(_open), CLOSE(_close))
for f, r, a in (("libinput_path_create_context", ctypes.c_void_p, [ctypes.POINTER(Iface), ctypes.c_void_p]),
                ("libinput_path_add_device", ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_char_p]),
                ("libinput_get_fd", ctypes.c_int, [ctypes.c_void_p]),
                ("libinput_dispatch", ctypes.c_int, [ctypes.c_void_p]),
                ("libinput_get_event", ctypes.c_void_p, [ctypes.c_void_p]),
                ("libinput_event_get_type", ctypes.c_int, [ctypes.c_void_p]),
                ("libinput_event_destroy", None, [ctypes.c_void_p]),
                ("libinput_event_get_pointer_event", ctypes.c_void_p, [ctypes.c_void_p]),
                ("libinput_event_pointer_get_button", ctypes.c_uint32, [ctypes.c_void_p]),
                ("libinput_event_pointer_get_button_state", ctypes.c_int, [ctypes.c_void_p]),
                ("libinput_event_pointer_get_seat_button_count", ctypes.c_uint32, [ctypes.c_void_p]),
                ("libinput_device_config_tap_set_enabled", ctypes.c_int, [ctypes.c_void_p, ctypes.c_int]),
                ("libinput_unref", ctypes.c_void_p, [ctypes.c_void_p])):
    getattr(li, f).restype = r; getattr(li, f).argtypes = a

class Reader:
    """Our own libinput context on one device: collects (button, state, seat count) and device removal."""
    def __init__(self, path):
        self.ctx = li.libinput_path_create_context(ctypes.byref(IFACE), None)
        dev = li.libinput_path_add_device(self.ctx, path.encode())
        assert dev, "libinput refused the test device"
        li.libinput_device_config_tap_set_enabled(dev, 0)
        self.fd = li.libinput_get_fd(self.ctx); self.buttons, self.removed = [], False
    def pump(self, secs):
        end = time.monotonic() + secs
        while time.monotonic() < end:
            select.select([self.fd], [], [], 0.02)
            li.libinput_dispatch(self.ctx)
            while True:
                ev = li.libinput_get_event(self.ctx)
                if not ev: break
                t = li.libinput_event_get_type(ev)
                if t == 402:
                    pe = li.libinput_event_get_pointer_event(ev)
                    self.buttons.append((li.libinput_event_pointer_get_button(pe), li.libinput_event_pointer_get_button_state(pe),
                                         li.libinput_event_pointer_get_seat_button_count(pe)))
                elif t == 2:
                    self.removed = True
                li.libinput_event_destroy(ev)
    def balanced(self):
        return not self.buttons or self.buttons[-1][2] == 0 and sum(1 if s else -1 for _, s, _ in self.buttons) == 0
    def close(self): li.libinput_unref(self.ctx)

results = []
def ok(name, cond, extra=""):
    results.append(cond); print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra and not cond else ""), flush=True)

def main():
    open(kt["RULE"], "w").write('SUBSYSTEM=="input", ATTRS{name}=="EGPU Buddy TEST*", ENV{ID_SEAT}="seat-egpu-test"\n')
    subprocess.run(["udevadm", "control", "--reload"])
    ts = kt["FakeTS"](); time.sleep(1.5); ts_path = kt["node"](kt["TS_NAME"])
    try:
        if "TEST" in kt["kwin_names"](): print("ABORT: KDE sees the test touchscreen"); return 2
        p, lis = kt["start_pad"](ts_path, "three")
        if "TEST" in kt["kwin_names"](): print("ABORT: KDE sees the test touchpad"); p.kill(); return 2
        rd = Reader(kt["node"](kt["PAD_NAME"])); rd.pump(0.3)
        # real-hand three-finger drags, fingers landing/lifting a few ms apart
        for order in ((0, 1, 2), (2, 1, 0)):
            ts.frame({0: (4000, 6000)}); time.sleep(0.008); ts.frame({0: (4010, 6000), 1: (5000, 6000)}); time.sleep(0.008)
            ts.frame({0: (4020, 6000), 1: (5010, 6000), 2: (6000, 6000)}); time.sleep(0.1)
            for k in range(1, 12):
                ts.frame({s: (4020 + 1000 * s + 150 * k, 6000 + 40 * k) for s in range(3)}); time.sleep(0.016)
            rd.pump(0.1); pressed = any(s == 1 for _, s, _ in rd.buttons)
            pts = {s: (6000, 6400) for s in range(3)}
            for s in order:
                del pts[s]; ts.frame(dict(pts)); time.sleep(0.01)
            rd.pump(0.4)
            ok(f"three-finger drag {order}: libinput press then release, seat count back to 0", pressed and rd.balanced(), rd.buttons)
            rd.buttons.clear()
            ts.frame({0: (3000, 3000)}); time.sleep(0.05); ts.frame({0: (3600, 3000)}); time.sleep(0.05); ts.frame({}); rd.pump(0.4)
            ok(f"after drag {order}: one-finger move gives no stray button", not rd.buttons, rd.buttons)
            rd.buttons.clear()
        # taps
        ts.frame({0: (5000, 5000)}); time.sleep(0.05); ts.frame({}); rd.pump(0.4)
        ok("one-finger tap: exactly one left click", [b[:2] for b in rd.buttons] == [(0x110, 1), (0x110, 0)] and rd.balanced(), rd.buttons)
        rd.buttons.clear()
        ts.frame({0: (5000, 5000), 1: (6000, 5000)}); time.sleep(0.05); ts.frame({}); rd.pump(0.4)
        ok("two-finger tap: exactly one right click", [b[:2] for b in rd.buttons] == [(0x111, 1), (0x111, 0)] and rd.balanced(), rd.buttons)
        rd.buttons.clear()
        # dies mid drag (touchpad killed -9, guardian releases)
        ts.frame({s: (4000 + 1000 * s, 6000) for s in range(3)}); time.sleep(0.1); ts.frame({s: (4200 + 1000 * s, 6000) for s in range(3)}); rd.pump(0.2)
        os.kill(p.pid, signal.SIGKILL); rd.pump(1.5)
        ok("killed -9 mid drag: libinput saw the release (count 0)", rd.buttons and rd.balanced(), rd.buttons)
        ts.frame({}); rd.close(); time.sleep(0.3)
        # both killed at once: does libinput itself release on removal?
        p, lis = kt["start_pad"](ts_path, "three"); rd = Reader(kt["node"](kt["PAD_NAME"])); rd.pump(0.3)
        ts.frame({s: (4000 + 1000 * s, 6000) for s in range(3)}); time.sleep(0.1); ts.frame({s: (4300 + 1000 * s, 6000) for s in range(3)}); rd.pump(0.2)
        subprocess.run(["pkill", "-KILL", "-f", "exec\\(open\\(sys.argv\\[1\\]"]); rd.pump(1.5)
        print(f"INFO both killed -9 at once: libinput buttons {rd.buttons}, removed={rd.removed}", flush=True)
        ts.frame({}); rd.close()
    finally:
        subprocess.run(["pkill", "-KILL", "-f", "exec\\(open\\(sys.argv\\[1\\]"])
        ts.close(); os.remove(kt["RULE"]); subprocess.run(["udevadm", "control", "--reload"])
    print("ALL PASS" if all(results) else f"{results.count(False)} FAILED"); return 0 if all(results) else 1

sys.exit(main())
