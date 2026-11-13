"""Driver Lab intent rules: what a patch MEANS, for the hunks a 3-way merge cannot place because NVIDIA rewrote the
code around them. Written once per patch, run by egpu-driver-lab with no AI and no human.

Each rule: (patch number, file, function). The function gets the conflicted file with NVIDIA's new code kept
("ours") and returns it with the patch's intent applied. ctx.base(path) / ctx.basep(path) give that file in the
previous NVIDIA version without / with our patches. Anything unexpected raises Block: the patch is then flagged for a
human, never guessed (fail closed)."""
import os, re


class Block(Exception):
    pass


def func_span(t, name):
    """(start, end) of the definition of C function `name` (body included); Block unless exactly one."""
    hits = []
    for m in re.finditer(r"^[^\n;{}#]*?\b" + re.escape(name) + r"\s*\(", t, re.M):
        o = t.find("\n{", m.end())
        if o < 0 or ";" in t[m.end():o]:
            continue   # a prototype or a call, not the definition
        c = t.find("\n}", o)
        if c < 0:
            continue
        hits.append((m.start(), c + 2))
    if len(hits) != 1:
        raise Block(f"{name}: {len(hits)} definitions found")
    return hits[0]


def funcs_calling(t, callee):
    """Names of the functions whose body calls `callee`."""
    out = set()
    for m in re.finditer(r"^(?:static\s+)?[A-Za-z_][^\n;{}#=]*?\b([A-Za-z_]\w*)\s*\([^;{}]*?\)\s*\{", t, re.M | re.S):
        o = t.find("{", m.end() - 1)
        c = t.find("\n}", o)
        if c > 0 and re.search(r"\b" + re.escape(callee) + r"\s*\(", t[o:c]):
            out.add(m.group(1))
    return out


# --- 160 (Thunderbolt eGPU hotplug) -----------------------------------------------------------------------------

def r160_fwsec_gpu_lost(ctx, t):
    """Driver unload after a surprise removal: a failed FWSEC-SB execution with the GPU already gone is not an error
    (the patch adds NV_ERR_GPU_IS_LOST to the failure test right after the FWSEC execute call)."""
    s, e = func_span(t, "kgspTeardown_TU102")
    body = t[s:e]
    pat = re.compile(r"(status\s*=\s*\w*Execute\w*Fwsec\w*\([^;]*\);\s*\n\s*if\s*\(\(status != NV_OK\) && "
                     r"\(status != NV_ERR_GPU_IN_FULLCHIP_RESET\))(\))")
    ms = list(pat.finditer(body))
    if len(ms) != 1:
        if re.search(r"Execute\w*Fwsec[^;]*;\s*\n\s*if\s*\([^\n]*NV_ERR_GPU_IS_LOST", body):
            return t   # already in
        raise Block(f"FWSEC execute check: {len(ms)} matches in kgspTeardown_TU102")
    m = ms[0]
    body = body[:m.end(1)] + " && (status != NV_ERR_GPU_IS_LOST)" + body[m.start(2):]
    return t[:s] + body + t[e:]


DISP_HELPER = """/*!
 * GetPerOpenDev() for the display ioctls (cursor, LUT, CRC32, vblank
 * semaphore controls).
 *
 * Surprise removal invalidates the underlying device before its open
 * handles are torn down. Reject late display ioctls rather than allowing
 * them to dereference stale display state.
 */
static struct NvKmsPerOpenDev *GetPerOpenDevForDisp(
    const struct NvKmsPerOpen *pOpen,
    const NvKmsDeviceHandle deviceHandle)
{
    struct NvKmsPerOpenDev *pOpenDev = GetPerOpenDev(pOpen, deviceHandle);

    if (pOpenDev == NULL ||
        pOpenDev->pDevEvo == NULL || pOpenDev->pDevEvo->gpuLost) {
        return NULL;
    }

    return pOpenDev;
}

"""


def r160_display_ioctls_lost_device(ctx, t):
    """Late display ioctls on a removed GPU are rejected. In the previous version the display ioctls found their device
    through a dev+disp lookup the patch guarded. Those same ioctl functions (read from the previous version, not
    chosen by hand) get a guarded device lookup in the new version."""
    old = ctx.basep("src/nvidia-modeset/src/nvkms.c")
    callers = funcs_calling(old, "GetPerOpenDevForDisp") or funcs_calling(ctx.base("src/nvidia-modeset/src/nvkms.c"), "GetPerOpenDevAndDisp")
    if not callers:
        raise Block("no display ioctls found in the previous version")
    if "GetPerOpenDevForDisp(" not in t:
        s, e = func_span(t, "GetPerOpenDev")
        cut = t.find("/*!", e)   # before the next function's comment block
        if cut < 0 or "{" in t[e:cut]:
            raise Block("no place after GetPerOpenDev for the guarded lookup")
        t = t[:cut] + DISP_HELPER + t[cut:]
    for f in sorted(callers):
        s, e = func_span(t, f)
        body = t[s:e]
        if "GetPerOpenDevForDisp(" in body:
            continue
        n = len(re.findall(r"\bGetPerOpenDev\(pOpen,\s*pParams->request\.deviceHandle\)", body))
        if n != 1:
            raise Block(f"{f}: {n} device lookups (expected 1)")
        body = re.sub(r"\bGetPerOpenDev\((pOpen,\s*pParams->request\.deviceHandle)\)", r"GetPerOpenDevForDisp(\1)", body)
        t = t[:s] + body + t[e:]
    return t


RULES = {
    "160": {
        "src/nvidia/src/kernel/gpu/gsp/arch/turing/kernel_gsp_tu102.c": r160_fwsec_gpu_lost,
        "src/nvidia-modeset/src/nvkms.c": r160_display_ioctls_lost_device,
    },
}


# --- after every patch is in: API drift and lifecycle invariants (not tied to one patch) ----------------------------
# ctx.repo: the ported tree; ctx.old(f) / ctx.new(f): NVIDIA's previous / new file; ctx.changed(): files our patches
# touch in the new tree; ctx.added(f): the lines they added there; ctx.grep_new(pattern) / ctx.grep_old(pattern): git grep in NVIDIA's new / previous tree.

def _args(t, open_paren):
    """Top-level argument spans of the call whose '(' is at open_paren: ([(start, end)], close_paren)."""
    depth, starts, commas = 0, [open_paren + 1], []
    for i in range(open_paren, len(t)):
        ch = t[i]
        if ch in "([{": depth += 1
        elif ch in ")]}":
            depth -= 1
            if depth == 0:
                ends = commas + [i]
                return list(zip(starts, ends)), i
        elif ch == "," and depth == 1:
            commas.append(i); starts.append(i + 1)
    raise Block("unbalanced call")


def drift_removed_macros(ctx):
    """A macro our patches use that NVIDIA removed: written out from its previous definition (one argument only)."""
    done = []
    for f in ctx.changed():
        p = os.path.join(ctx.repo, f); t = open(p, errors="replace").read()
        for name in sorted(set(re.findall(r"\b(NV_[A-Z0-9_]+)\(", ctx.added(f)))):   # only what our patches added
            if ctx.grep_new(r"#\s*define\s+" + name + r"\b"):
                continue
            hits = ctx.grep_old(r"#\s*define\s+" + name + r"\(")
            if not hits:
                continue   # never a macro: a function or something else, the build decides
            src = ctx.old(hits[0])
            m = re.search(r"#\s*define\s+" + name + r"\((\w+)\)\s*((?:[^\n]*\\\n)*[^\n]*)", src)
            if not m:
                raise Block(f"{name}: previous definition is not a one-argument macro")
            arg, body = m.group(1), re.sub(r"\\\n\s*", "", m.group(2)).strip()
            out, i = [], 0
            for mm in re.finditer(r"\b" + name + r"\(", t):
                if mm.start() < i: continue
                spans, close = _args(t, mm.end() - 1)
                if len(spans) != 1: raise Block(f"{name}: used with {len(spans)} arguments")
                a = t[spans[0][0]:spans[0][1]].strip()
                b = body.replace("(" + arg + ")", a if re.fullmatch(r"\w+", a) else "(" + a + ")")
                out.append(t[i:mm.start()] + b); i = close + 1
            t = "".join(out) + t[i:]
            open(p, "w").write(t); done.append(f"{f}: {name} written out")
    return done


def _static_sigs(t):
    """{name: [parameter names]} for every static function definition (None when a parameter is not a plain name)."""
    out = {}
    for m in re.finditer(r"^static\b[^;{}()]*?\b(\w+)\s*\(([^;{}()]*(?:\([^;{}()]*\)[^;{}()]*)*)\)\s*\{", t, re.M):
        names = []
        for prm in m.group(2).split(","):
            prm = prm.strip()
            if not prm or prm == "void": continue
            mm = re.search(r"(\w+)\s*(\[[^\]]*\])?$", prm)
            if not mm or "(" in prm: names = None; break
            names.append(mm.group(1))
        out[m.group(1)] = names
    return out


def drift_dropped_params(ctx):
    """A static function NVIDIA gave fewer parameters (a strict subset of the old ones): calls with the old argument
    count drop the removed arguments."""
    done = []
    for f in ctx.changed():
        if not f.endswith(".c"): continue
        old, new = ctx.old(f), ctx.new(f)
        if not old or not new: continue
        so, sn = _static_sigs(old), _static_sigs(new)
        cand = {n: (so[n], sn[n]) for n in sn if so.get(n) and sn[n] and len(sn[n]) < len(so[n]) and set(sn[n]) <= set(so[n])}
        if not cand: continue
        p = os.path.join(ctx.repo, f); t = open(p, errors="replace").read()
        for name, (po, pn) in sorted(cand.items()):
            drop = {k for k, x in enumerate(po) if x not in pn}
            out, i, n = [], 0, 0
            for mm in re.finditer(r"\b" + re.escape(name) + r"\(", t):
                if mm.start() < i: continue
                line = t[t.rfind("\n", 0, mm.start()) + 1:mm.start()].strip()
                if line.startswith("static") or line.startswith("*"): continue
                spans, close = _args(t, mm.end() - 1)
                if len(spans) != len(po): continue
                keep = [k for k in range(len(spans)) if k not in drop]
                seg = t[i:mm.end()] + ",".join(t[spans[k][0]:spans[k][1]] for k in keep)
                out.append(seg); i = close; n += 1
            if n:
                t = "".join(out) + t[i:]; done.append(f"{f}: {name}() dropped argument(s) {sorted(drop)} in {n} call(s)")
        open(p, "w").write(t)
    return done


def inv_removal_cancels_all_workers(ctx):
    """nvidia-drm removal path (our hotplug patch): event handling is switched off FIRST, then EVERY deferred event
    worker of the device is cancelled, so none can re-queue against a device that is going away. The set of workers is
    read from the new version (NVIDIA added a content-protection worker in 620: the known port trap)."""
    f = "kernel-open/nvidia-drm/nvidia-drm-drv.c"; p = os.path.join(ctx.repo, f)
    if not os.path.exists(p): raise Block(f"{f} is gone")
    t = open(p, errors="replace").read()
    workers = re.findall(r"INIT_DELAYED_WORK\(&nv_dev->(\w+)", t)
    m = re.search(r"wake_up_all\(&nv_dev->flip_event_wq\);(.*?)(\n([ \t]*)atomic_set\(&nv_dev->enable_event_handling, false\);\n)"
                  r"((?:[ \t]*cancel_delayed_work_sync\(&nv_dev->\w+\);\n)*)", t, re.S)
    if not m or not workers: raise Block("removal path or workers not found")
    pre = re.sub(r"\n[ \t]*cancel_delayed_work_sync\(&nv_dev->\w+\);", "", m.group(1))
    ind = m.group(3)
    add = "".join(f"{ind}cancel_delayed_work_sync(&nv_dev->{w});\n" for w in workers)
    t2 = t[:m.start(1)] + pre + m.group(2) + add + t[m.end(4):]   # cancels already after it are replaced, not doubled
    if t2 == t: return []
    open(p, "w").write(t2); return [f"{f}: removal cancels {', '.join(workers)} after event handling is off"]


POST = [drift_removed_macros, drift_dropped_params, inv_removal_cancels_all_workers]
