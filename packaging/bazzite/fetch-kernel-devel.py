#!/usr/bin/env python3
"""Download kernel-devel for EXACTLY the running Bazzite kernel (Bazzite only).
Bazzite's kernel (the Open Gaming Collective "ogc" kernel) publishes its RPMs as an OCI artifact on ghcr.io, one layer
per RPM, named by the org.opencontainers.image.title annotation: ghcr.io/opengamingcollective/kernel-packages-fedora,
tag "<version>-<release with .fc -> -fc>", e.g. 7.2.9-ogc3.1.fc44.x86_64 -> 7.2.9-ogc3.1-fc44. Anonymous pull token.
The blob is verified against its sha256 digest.   usage: fetch-kernel-devel.py <uname -r> <output .rpm>"""
import hashlib, json, os, sys, urllib.request

REPO = "opengamingcollective/kernel-packages-fedora"


def get(url, token=None, accept=None):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if accept:
        req.add_header("Accept", accept)
    return urllib.request.urlopen(req, timeout=120)


def main():
    kver, out = sys.argv[1], sys.argv[2]
    arch = kver.rsplit(".", 1)[1]
    base = kver[: -(len(arch) + 1)]                       # 7.2.9-ogc3.1.fc44
    tag = base.replace(".fc", "-fc")                       # 7.2.9-ogc3.1-fc44
    want = f"kernel-devel-{kver}.rpm"
    token = json.load(get(f"https://ghcr.io/token?scope=repository:{REPO}:pull"))["token"]
    acc = ",".join(["application/vnd.oci.image.manifest.v1+json", "application/vnd.oci.image.index.v1+json",
                    "application/vnd.docker.distribution.manifest.v2+json"])
    man = json.load(get(f"https://ghcr.io/v2/{REPO}/manifests/{tag}", token, acc))
    if "manifests" in man:                                 # an index: take the entry for this architecture
        m = next((m for m in man["manifests"] if m.get("platform", {}).get("architecture") in ("amd64", arch)), man["manifests"][0])
        man = json.load(get(f"https://ghcr.io/v2/{REPO}/manifests/{m['digest']}", token, acc))
    layer = next((l for l in man.get("layers", []) if l.get("annotations", {}).get("org.opencontainers.image.title") == want), None)
    if not layer:
        sys.exit(f"{want} is not published in ghcr.io/{REPO}:{tag}")
    h = hashlib.sha256(); tmp = out + ".part"
    with get(f"https://ghcr.io/v2/{REPO}/blobs/{layer['digest']}", token) as r, open(tmp, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            h.update(b); f.write(b)
    if "sha256:" + h.hexdigest() != layer["digest"]:
        os.unlink(tmp); sys.exit("checksum mismatch on " + want)
    os.replace(tmp, out); print(f"{want} ({layer['size']} bytes, {layer['digest'][:19]})")


if __name__ == "__main__":
    main()
