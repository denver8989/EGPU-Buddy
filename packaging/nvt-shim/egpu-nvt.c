/* egpu-nvt: EGPU Buddy's NVIDIA settings (experimental), applied at every game launch.
 *
 * Loaded through LD_PRELOAD into the programs of a session whose games render on the NVIDIA eGPU (the Game Mode session
 * wrapper and the plasma env script add it on those routes only, and only once the user has saved NVIDIA settings).
 * At load it reads two small files egpu-nvidia-tweaks keeps up to date and hands their values to the program that is
 * starting - so a change applies at the next game launch, with no Steam or Game Mode restart.
 *
 *   ~/.config/egpu-buddy/nvidia-tweaks.env        KEY=VALUE lines (NVIDIA driver, vkd3d-proton)
 *   ~/.config/egpu-buddy/nvidia-tweaks.dxvk.conf  DXVK options
 *
 * It does nothing at all unless ALL of these hold: Vulkan is pinned to NVIDIA's driver (VK_DRIVER_FILES names
 * nvidia_icd), Steam started the program for a game (SteamGameId or SteamAppId: Steam games and non-Steam games added to
 * Steam), and it is not Steam itself. A value already in the environment (a launch option, the user's own setting) is
 * never replaced. DXVK: DXVK reads ONE file - $DXVK_CONFIG_FILE, else dxvk.conf in the working directory (the game's own).
 * The file given to DXVK is ours FOLLOWED BY that file, so the game's (or the user's) own options still come last and
 * win; DXVK_CONFIG from a launch option is applied by DXVK on top of everything, as always.
 * NV GPU Buddy track (built-in NVIDIA card, experimental): its session drop-ins set NV_GPU_BUDDY=1, which stands in for
 * the Vulkan pin (there is no eGPU route there), and nv-gpu-buddy.env (the installer's: on a laptop, NVIDIA render
 * offload for games) is applied first the same way. Neither exists on an eGPU install, so nothing changes there.
 * Plain C, no allocation, no threads, bounded buffers; old glibc symbols only (it also loads inside Steam's runtime). */
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define CAP 16384

static int slurp(const char *path, char *buf, size_t cap) {
  int fd = open(path, O_RDONLY | O_CLOEXEC);
  if (fd < 0) return -1;
  size_t n = 0;
  while (n < cap - 1) {
    ssize_t r = read(fd, buf + n, cap - 1 - n);
    if (r < 0) { if (errno == EINTR) continue; break; }
    if (r == 0) break;
    n += (size_t)r;
  }
  close(fd);
  buf[n] = 0;
  return (int)n;
}

static int is_steam_itself(void) {
  char comm[64];
  if (slurp("/proc/self/comm", comm, sizeof comm) <= 0) return 0;
  char *nl = strchr(comm, '\n'); if (nl) *nl = 0;
  return !strcmp(comm, "steam") || !strcmp(comm, "steamwebhelper") || !strncmp(comm, "steam-runtime", 13);
}

static void apply_env(const char *home, const char *name) {
  char path[512], buf[CAP];
  if (snprintf(path, sizeof path, "%s/.config/egpu-buddy/%s", home, name) >= (int)sizeof path) return;
  if (slurp(path, buf, sizeof buf) <= 0) return;
  for (char *line = buf, *next; line && *line; line = next) {
    next = strchr(line, '\n'); if (next) *next++ = 0;
    char *eq = strchr(line, '=');
    if (!eq || eq == line || line[0] == '#') continue;
    *eq = 0;
    int ok = 1;   /* names: [A-Za-z0-9_] only */
    for (char *c = line; *c; c++) if (!((*c >= 'A' && *c <= 'Z') || (*c >= 'a' && *c <= 'z') || (*c >= '0' && *c <= '9') || *c == '_')) ok = 0;
    if (ok) setenv(line, eq + 1, 0);   /* 0: never over a value that is already set */
  }
}

static unsigned long fnv(const char *s, size_t n) {
  unsigned long h = 2166136261UL;
  for (size_t i = 0; i < n; i++) { h ^= (unsigned char)s[i]; h *= 16777619UL; }
  return h & 0xffffffffUL;
}

static void apply_dxvk(const char *home) {
  static char ours[CAP], own[CAP], all[2 * CAP + 64];
  char path[512], out[512], dir[512];
  if (snprintf(path, sizeof path, "%s/.config/egpu-buddy/nvidia-tweaks.dxvk.conf", home) >= (int)sizeof path) return;
  int n = slurp(path, ours, sizeof ours);
  if (n <= 0) return;
  /* the file DXVK would read without us: the user's DXVK_CONFIG_FILE, else the game's own dxvk.conf. An earlier process
   * of this launch (Proton's script, wine) may have set DXVK_CONFIG_FILE to one of OUR files: then it is ours, not the
   * user's, and the working directory decides again (the game's own process is the one whose directory counts). */
  const char *base = getenv("DXVK_CONFIG_FILE");
  const char *mine = getenv("EGPU_NVT_DXVK");
  if (!base || !*base || (mine && !strcmp(base, mine))) base = "dxvk.conf";
  int m = slurp(base, own, sizeof own);
  if (m < 0) m = 0;
  int len = snprintf(all, sizeof all, "# EGPU Buddy NVIDIA settings\n%s\n# own options (%s)\n%s\n", ours, base, own);
  if (len <= 0 || len >= (int)sizeof all) return;
  const char *rt = getenv("XDG_RUNTIME_DIR");
  if (!rt || !*rt) return;
  if (snprintf(dir, sizeof dir, "%s/egpu-nvt", rt) >= (int)sizeof dir) return;
  mkdir(dir, 0700);
  if (snprintf(out, sizeof out, "%s/dxvk-%08lx.conf", dir, fnv(all, (size_t)len)) >= (int)sizeof out) return;
  if (access(out, R_OK) != 0) {   /* same content -> same file: written once, shared by every launch */
    char tmp[560];
    if (snprintf(tmp, sizeof tmp, "%s.%d", out, (int)getpid()) >= (int)sizeof tmp) return;
    int fd = open(tmp, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
    if (fd < 0) return;
    ssize_t w = write(fd, all, (size_t)len);
    close(fd);
    if (w != len || rename(tmp, out) != 0) { unlink(tmp); return; }
  }
  setenv("DXVK_CONFIG_FILE", out, 1);
  setenv("EGPU_NVT_DXVK", out, 1);
}

__attribute__((constructor)) static void egpu_nvt_init(void) {
  const char *vk = getenv("VK_DRIVER_FILES");
  const char *nvb = getenv("NV_GPU_BUDDY");
  int builtin = nvb && !strcmp(nvb, "1");
  if (!builtin && (!vk || !strstr(vk, "nvidia_icd"))) return;   /* not rendering on the NVIDIA eGPU */
  if (!getenv("SteamGameId") && !getenv("SteamAppId")) return;   /* not a game Steam started */
  if (getenv("EGPU_NVT_OFF")) return;                     /* per-game way out: EGPU_NVT_OFF=1 */
  const char *home = getenv("HOME");
  if (!home || !*home || is_steam_itself()) return;
  int saved = errno;
  if (builtin) apply_env(home, "nv-gpu-buddy.env");
  apply_env(home, "nvidia-tweaks.env");
  apply_dxvk(home);
  errno = saved;
}
