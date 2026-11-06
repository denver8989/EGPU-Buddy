/* egpu-steam-ui: EGPU Buddy's Steam menu fix for Big Art mode on an NVIDIA eGPU (opt-in).
 *
 * Steam's interface (steamwebhelper browser process) composites its windows with its own GL compositor, which needs
 * GLX_EXT_texture_from_pixmap. NVIDIA's GLX does not offer it on Xwayland (gamescope), so Steam falls back to plain X
 * windows: in Big Art mode the main menu then slides in over a black bar. This library supplies the extension to Steam's
 * GL loader: a window's buffer is taken over DRI3, copied on the NVIDIA GPU with Vulkan into a texture shared with GL
 * (GL_EXT_memory_object_fd) and from there into Steam's texture. CPU fallback: MIT-SHM read-back of the changed parts.
 * Loaded only through EGPU Buddy's runtime entry point (STEAM_RUNTIME_STEAMRT, set by the session on the NVIDIA eGPU
 * route when the user turned the fix on); active only in the steamwebhelper browser process with EGPU_TFP=1.
 * No Steam file is changed. Log: ~/.local/state/nv-egpu-buddy/steam-ui-fix.log (setup lines and errors only). */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <fcntl.h>
#include <unistd.h>
#include <X11/Xlib.h>
#include <GL/gl.h>
#include <GL/glx.h>
#include <xcb/xcb.h>
#include <xcb/shm.h>
#include <X11/extensions/Xdamage.h>
#include <X11/extensions/Xfixes.h>
#include <time.h>
#include <sys/stat.h>
#include <vulkan/vulkan.h>
#include <xcb/dri3.h>

#define TFP_EXT "GLX_EXT_texture_from_pixmap"
static void LOGW(const char *t) {
  static char path[512]; static int lines;
  if (lines++ > 200) return;   /* setup lines and the first errors only */
  if (!path[0]) { const char *h = getenv("HOME"); snprintf(path, sizeof path, "%s/.local/state/nv-egpu-buddy/steam-ui-fix.log", h ? h : "/tmp"); }
  int fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0644); if (fd >= 0) { if (write(fd, t, strlen(t)) < 0) {} close(fd); } }
#define LOG(...) do { char _b[512]; snprintf(_b, sizeof _b, __VA_ARGS__); LOGW(_b); } while (0)

typedef void *(*dlsym_fn)(void *, const char *);
typedef void *(*gpa_fn)(const GLubyte *);
static dlsym_fn real_dlsym;
static gpa_fn real_gpa;
static int active = -1;

static int is_browser(void) {
  char b[4096]; FILE *f = fopen("/proc/self/cmdline", "r"); if (!f) return 0;
  size_t n = fread(b, 1, sizeof b - 1, f); fclose(f); b[n] = 0;
  for (size_t i = 0; i + 7 < n; i++) if (!memcmp(b + i, "--type=", 7)) return 0;
  return strstr(b, "steamwebhelper") != NULL;
}
static int on(void) { if (active < 0) { active = is_browser() && getenv("EGPU_TFP"); if (active) LOG("egpu-steam-ui: active pid %d\n", (int)getpid()); } return active; }
static dlsym_fn rdlsym(void) {
  if (!real_dlsym) { real_dlsym = (dlsym_fn)dlvsym(RTLD_NEXT, "dlsym", "GLIBC_2.34"); if (!real_dlsym) real_dlsym = (dlsym_fn)dlvsym(RTLD_NEXT, "dlsym", "GLIBC_2.2.5"); }
  return real_dlsym;
}
static void *rgpa(const char *n) {
  if (!real_gpa) { void *h = dlopen("libGLX.so.0", RTLD_LAZY | RTLD_NOLOAD); if (!h) h = dlopen("libGL.so.1", RTLD_LAZY); real_gpa = (gpa_fn)rdlsym()(h, "glXGetProcAddressARB"); }
  return real_gpa ? real_gpa((const GLubyte *)n) : NULL;
}

/* ---- GLX pixmap table: GLXPixmap id == X pixmap id ---- */
#define MAXP 256
static struct { XID pix; int target, rgba; Window win; } tab[MAXP];
/* pixmap -> window, from Steam's own XCompositeNameWindowPixmap calls */
static struct { Pixmap p; Window w; } pw[MAXP]; static int pwi;
/* per window: damage object, texture we last filled, its size */
static struct { Window win; Damage dmg; GLuint tex, mytex; int w, h, fmt; void *ctx;
  /* GPU path: the window's buffer imported into Vulkan, and our GL-shared copy target */
  VkImage src, dst; VkDeviceMemory srcmem, dstmem; dev_t sdev; ino_t sino; GLuint gtex, gmem; int gw, gh; void *gctx; } ws[64];
static Display *pd; static int dmg_ok;
static double t_sync, t_read, t_copy; static unsigned long long px_read;
static unsigned long n_gpu;
static int depth_of_window_ok(xcb_pixmap_t p) { (void)p; return 1; }
static unsigned long n_full, n_part, n_skip, r_nowin, r_new, r_size, r_ctx; static double t_sum;
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static xcb_connection_t *xc; static int shmid = -1; static void *shmaddr; static size_t shmsz; static xcb_shm_seg_t seg;

Pixmap XCompositeNameWindowPixmap(Display *dpy, Window w) {
  static Pixmap (*real)(Display *, Window); if (!real) real = (Pixmap (*)(Display *, Window))rdlsym()(RTLD_NEXT, "XCompositeNameWindowPixmap");
  Pixmap p = real(dpy, w);
  pthread_mutex_lock(&mu); pw[pwi].p = p; pw[pwi].w = w; pwi = (pwi + 1) % MAXP; pthread_mutex_unlock(&mu);
  return p;
}
static double now_ms(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * 1e3 + t.tv_nsec / 1e6; }
static int passthrough;   /* the real GLX has the extension (Mesa, handheld GPU): never step in */
static const char *my_qes(Display *d, int s) {
  static char buf[8192]; const char *(*f)(Display *, int) = rgpa("glXQueryExtensionsString");
  const char *r = f ? f(d, s) : ""; if (strstr(r, TFP_EXT)) { if (!passthrough) LOG("egpu-steam-ui: the GLX in use has the extension itself: not needed\n"); passthrough = 1; return r; }
  snprintf(buf, sizeof buf, "%s %s ", r, TFP_EXT); return buf;
}
static GLXFBConfig *my_choose(Display *d, int s, const int *a, int *n) {
  if (passthrough) { GLXFBConfig *(*rf)(Display *, int, const int *, int *) = rgpa("glXChooseFBConfig"); return rf(d, s, a, n); }
  int b[128], k = 0; GLXFBConfig *(*f)(Display *, int, const int *, int *) = rgpa("glXChooseFBConfig");
  for (int i = 0; a && a[i] != None && k < 126; i += 2) {
    if (a[i] == GLX_BIND_TO_TEXTURE_RGB_EXT || a[i] == GLX_BIND_TO_TEXTURE_RGBA_EXT || a[i] == GLX_BIND_TO_MIPMAP_TEXTURE_EXT ||
        a[i] == GLX_BIND_TO_TEXTURE_TARGETS_EXT || a[i] == GLX_Y_INVERTED_EXT) continue;
    if (a[i] == GLX_DRAWABLE_TYPE) { b[k++] = a[i]; b[k++] = a[i + 1] & ~GLX_PIXMAP_BIT; continue; }
    b[k++] = a[i]; b[k++] = a[i + 1];
  }
  b[k] = None; GLXFBConfig *r = f(d, s, b, n); return r;
}
static int my_getattr(Display *d, GLXFBConfig c, int at, int *v) {
  if (passthrough) { int (*rf)(Display *, GLXFBConfig, int, int *) = rgpa("glXGetFBConfigAttrib"); return rf(d, c, at, v); }
  int (*f)(Display *, GLXFBConfig, int, int *) = rgpa("glXGetFBConfigAttrib");
  switch (at) {
    case GLX_BIND_TO_TEXTURE_RGB_EXT: case GLX_BIND_TO_TEXTURE_RGBA_EXT: *v = True; return Success;
    case GLX_BIND_TO_MIPMAP_TEXTURE_EXT: *v = False; return Success;
    case GLX_BIND_TO_TEXTURE_TARGETS_EXT: *v = GLX_TEXTURE_2D_BIT_EXT | GLX_TEXTURE_RECTANGLE_BIT_EXT; return Success;
    case GLX_Y_INVERTED_EXT: *v = True; return Success;
    case GLX_DRAWABLE_TYPE: { int r = f(d, c, at, v); *v |= GLX_PIXMAP_BIT; return r; }
  }
  return f(d, c, at, v);
}
static GLXPixmap my_create(Display *d, GLXFBConfig c, Pixmap p, const int *a) {
  if (passthrough) { GLXPixmap (*rf)(Display *, GLXFBConfig, Pixmap, const int *) = rgpa("glXCreatePixmap"); return rf(d, c, p, a); }
  int target = GL_TEXTURE_2D, rgba = 1;
  for (int i = 0; a && a[i] != None; i += 2) {
    if (a[i] == GLX_TEXTURE_TARGET_EXT) target = a[i + 1] == GLX_TEXTURE_RECTANGLE_EXT ? 0x84F5 : GL_TEXTURE_2D;
    if (a[i] == GLX_TEXTURE_FORMAT_EXT) rgba = a[i + 1] == GLX_TEXTURE_FORMAT_RGBA_EXT;
  }
  pthread_mutex_lock(&mu);
  static int next; int slot = -1; for (int i = 0; i < MAXP; i++) if (tab[i].pix == p) { slot = i; break; }
  if (slot < 0) { slot = next; next = (next + 1) % MAXP; }   /* ring: Steam may free pixmaps without glXDestroyPixmap */
  Window win = 0; for (int i = 0; i < MAXP; i++) if (pw[i].p == p) { win = pw[i].w; break; }
  if (slot >= 0) { tab[slot].pix = p; tab[slot].target = target; tab[slot].rgba = rgba; tab[slot].win = win; }
  pthread_mutex_unlock(&mu);
  return p;
}
static void my_destroy(Display *d, GLXPixmap p) {
  if (passthrough) { void (*rf)(Display *, GLXPixmap) = rgpa("glXDestroyPixmap"); rf(d, p); return; }
  pthread_mutex_lock(&mu); for (int i = 0; i < MAXP; i++) if (tab[i].pix == p) tab[i].pix = 0; pthread_mutex_unlock(&mu);
}

/* ---------------- GPU path: DRI3 buffer -> Vulkan (NVIDIA) blit -> GL texture via GL_EXT_memory_object_fd ---------------- */
static int vk_state;   /* 0 untried, 1 ok, -1 unavailable */
static VkInstance vi; static VkPhysicalDevice vpd; static VkDevice vd; static VkQueue vq; static uint32_t vqf;
static VkCommandPool vcp; static VkCommandBuffer vcb; static VkFence vfence; static VkPhysicalDeviceMemoryProperties vmp;
static PFN_vkGetDeviceProcAddr gdpa;
#define DF(n) static PFN_##n p_##n
DF(vkCreateImage); DF(vkDestroyImage); DF(vkGetImageMemoryRequirements); DF(vkAllocateMemory); DF(vkFreeMemory); DF(vkBindImageMemory);
DF(vkGetMemoryFdKHR); DF(vkGetMemoryFdPropertiesKHR); DF(vkBeginCommandBuffer); DF(vkEndCommandBuffer); DF(vkCmdPipelineBarrier);
DF(vkCmdBlitImage); DF(vkQueueSubmit); DF(vkWaitForFences); DF(vkResetFences); DF(vkResetCommandBuffer);
static int vk_init(void) {
  if (vk_state) return vk_state > 0;
  vk_state = -1;
  void *h = dlopen("libvulkan.so.1", RTLD_NOW | RTLD_LOCAL); if (!h) { LOG("egpu-steam-ui: no libvulkan\n"); return 0; }
  PFN_vkGetInstanceProcAddr gipa = (PFN_vkGetInstanceProcAddr)rdlsym()(h, "vkGetInstanceProcAddr");
  PFN_vkCreateInstance ci = (PFN_vkCreateInstance)gipa(NULL, "vkCreateInstance");
  VkApplicationInfo ai = { VK_STRUCTURE_TYPE_APPLICATION_INFO, NULL, "egpu-tfp", 1, NULL, 0, VK_API_VERSION_1_2 };
  VkInstanceCreateInfo ii = { VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO, NULL, 0, &ai, 0, NULL, 0, NULL };
  if (ci(&ii, NULL, &vi) != VK_SUCCESS) { LOG("egpu-steam-ui: vkCreateInstance failed\n"); return 0; }
  PFN_vkEnumeratePhysicalDevices ep = (PFN_vkEnumeratePhysicalDevices)gipa(vi, "vkEnumeratePhysicalDevices");
  PFN_vkGetPhysicalDeviceProperties gp = (PFN_vkGetPhysicalDeviceProperties)gipa(vi, "vkGetPhysicalDeviceProperties");
  uint32_t n = 8; VkPhysicalDevice pds[8]; ep(vi, &n, pds);
  for (uint32_t i = 0; i < n; i++) { VkPhysicalDeviceProperties pr; gp(pds[i], &pr); if (pr.vendorID == 0x10de) { vpd = pds[i]; break; } }
  if (!vpd) { LOG("egpu-steam-ui: no NVIDIA Vulkan device\n"); return 0; }
  ((PFN_vkGetPhysicalDeviceMemoryProperties)gipa(vi, "vkGetPhysicalDeviceMemoryProperties"))(vpd, &vmp);
  PFN_vkGetPhysicalDeviceQueueFamilyProperties qf = (PFN_vkGetPhysicalDeviceQueueFamilyProperties)gipa(vi, "vkGetPhysicalDeviceQueueFamilyProperties");
  uint32_t nq = 16; VkQueueFamilyProperties qp[16]; qf(vpd, &nq, qp); vqf = 0;
  for (uint32_t i = 0; i < nq; i++) if (qp[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) { vqf = i; break; }
  float prio = 1; VkDeviceQueueCreateInfo qi = { VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO, NULL, 0, vqf, 1, &prio };
  const char *ext[] = { "VK_KHR_external_memory_fd", "VK_EXT_external_memory_dma_buf", "VK_EXT_image_drm_format_modifier", "VK_EXT_queue_family_foreign" };
  VkDeviceCreateInfo di = { VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO, NULL, 0, 1, &qi, 0, NULL, 4, ext, NULL };
  if (((PFN_vkCreateDevice)gipa(vi, "vkCreateDevice"))(vpd, &di, NULL, &vd) != VK_SUCCESS) { LOG("egpu-steam-ui: vkCreateDevice failed\n"); return 0; }
  gdpa = (PFN_vkGetDeviceProcAddr)gipa(vi, "vkGetDeviceProcAddr");
#define LD(n) p_##n = (PFN_##n)gdpa(vd, #n)
  LD(vkCreateImage); LD(vkDestroyImage); LD(vkGetImageMemoryRequirements); LD(vkAllocateMemory); LD(vkFreeMemory); LD(vkBindImageMemory);
  LD(vkGetMemoryFdKHR); LD(vkGetMemoryFdPropertiesKHR); LD(vkBeginCommandBuffer); LD(vkEndCommandBuffer); LD(vkCmdPipelineBarrier);
  LD(vkCmdBlitImage); LD(vkQueueSubmit); LD(vkWaitForFences); LD(vkResetFences); LD(vkResetCommandBuffer);
  ((PFN_vkGetDeviceQueue)gdpa(vd, "vkGetDeviceQueue"))(vd, vqf, 0, &vq);
  VkCommandPoolCreateInfo pi = { VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO, NULL, VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT, vqf };
  ((PFN_vkCreateCommandPool)gdpa(vd, "vkCreateCommandPool"))(vd, &pi, NULL, &vcp);
  VkCommandBufferAllocateInfo ba = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO, NULL, vcp, VK_COMMAND_BUFFER_LEVEL_PRIMARY, 1 };
  ((PFN_vkAllocateCommandBuffers)gdpa(vd, "vkAllocateCommandBuffers"))(vd, &ba, &vcb);
  VkFenceCreateInfo fi = { VK_STRUCTURE_TYPE_FENCE_CREATE_INFO, NULL, 0 };
  ((PFN_vkCreateFence)gdpa(vd, "vkCreateFence"))(vd, &fi, NULL, &vfence);
  vk_state = 1; LOG("egpu-steam-ui: GPU path ready (NVIDIA Vulkan)\n"); return 1;
}
static int memtype(uint32_t bits, VkMemoryPropertyFlags want) {
  for (uint32_t i = 0; i < vmp.memoryTypeCount; i++) if ((bits & (1u << i)) && (vmp.memoryTypes[i].propertyFlags & want) == want) return i;
  for (uint32_t i = 0; i < vmp.memoryTypeCount; i++) if (bits & (1u << i)) return i;
  return -1;
}
static void gpu_drop_src(int k) { if (ws[k].src) { p_vkDestroyImage(vd, ws[k].src, NULL); p_vkFreeMemory(vd, ws[k].srcmem, NULL); } ws[k].src = 0; ws[k].srcmem = 0; ws[k].sino = 0; }
static void gpu_drop_dst(int k, void (*deltex)(GLsizei, const GLuint *), void (*delmem)(GLsizei, const GLuint *)) {
  if (ws[k].gtex) { deltex(1, &ws[k].gtex); delmem(1, &ws[k].gmem); }
  if (ws[k].dst) { p_vkDestroyImage(vd, ws[k].dst, NULL); p_vkFreeMemory(vd, ws[k].dstmem, NULL); }
  ws[k].gtex = ws[k].gmem = 0; ws[k].dst = 0; ws[k].dstmem = 0; ws[k].gw = ws[k].gh = 0;
}
/* fills our GL texture ws[k].gtex with the pixmap's current contents; 0 = not possible here (caller uses the CPU path) */
static int gpu_fill(int k, xcb_pixmap_t p, int w, int h, void *ctx) {
  static void (*deltex)(GLsizei, const GLuint *), (*delmem)(GLsizei, const GLuint *), (*createmem)(GLsizei, GLuint *), (*memparam)(GLuint, GLenum, const GLint *);
  static void (*importfd)(GLuint, GLuint64, GLenum, GLint), (*texstoragemem)(GLenum, GLsizei, GLenum, GLsizei, GLsizei, GLuint, GLuint64);
  static void (*gentex)(GLsizei, GLuint *), (*bindtex)(GLenum, GLuint), (*texpar)(GLenum, GLenum, GLint);
  if (!deltex) { deltex = rgpa("glDeleteTextures"); delmem = rgpa("glDeleteMemoryObjectsEXT"); createmem = rgpa("glCreateMemoryObjectsEXT"); memparam = rgpa("glMemoryObjectParameterivEXT");
                 importfd = rgpa("glImportMemoryFdEXT"); texstoragemem = rgpa("glTexStorageMem2DEXT"); gentex = rgpa("glGenTextures"); bindtex = rgpa("glBindTexture"); texpar = rgpa("glTexParameteri"); }
  if (!createmem || !importfd || !texstoragemem || !vk_init()) return 0;
  /* 1. the window's buffer (DRI3 1.2) */
  xcb_dri3_buffers_from_pixmap_reply_t *br = xcb_dri3_buffers_from_pixmap_reply(xc, xcb_dri3_buffers_from_pixmap(xc, p), NULL);
  if (!br) { static int nl; if (nl++ < 3) LOG("egpu-steam-ui: DRI3 buffers_from_pixmap failed\n"); return 0; }
  int *fds = xcb_dri3_buffers_from_pixmap_reply_fds(xc, br); uint32_t *strides = xcb_dri3_buffers_from_pixmap_strides(br), *offs = xcb_dri3_buffers_from_pixmap_offsets(br);
  int ok = 0, nfd = br->nfd; uint64_t mod = br->modifier; int depth = br->depth, bpp = br->bpp;
  if (nfd != 1 || bpp != 32 || depth != 32 || br->width != w || br->height != h) { static int nl; if (nl++ < 5) LOG("egpu-steam-ui: GPU path skip nfd %d bpp %d depth %d %dx%d\n", nfd, bpp, depth, br->width, br->height); goto out; }
  struct stat st; fstat(fds[0], &st);
  if (!ws[k].src || ws[k].sdev != st.st_dev || ws[k].sino != st.st_ino) {
    gpu_drop_src(k);
    VkExternalMemoryImageCreateInfo ext = { VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_IMAGE_CREATE_INFO, NULL, VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT };
    VkSubresourceLayout pl = { offs[0], 0, strides[0], 0, 0 };
    VkImageDrmFormatModifierExplicitCreateInfoEXT me = { VK_STRUCTURE_TYPE_IMAGE_DRM_FORMAT_MODIFIER_EXPLICIT_CREATE_INFO_EXT, &ext, mod, 1, &pl };
    VkImageCreateInfo ic = { VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO, &me, 0, VK_IMAGE_TYPE_2D, VK_FORMAT_B8G8R8A8_UNORM, { w, h, 1 }, 1, 1, VK_SAMPLE_COUNT_1_BIT,
                             VK_IMAGE_TILING_DRM_FORMAT_MODIFIER_EXT, VK_IMAGE_USAGE_TRANSFER_SRC_BIT, VK_SHARING_MODE_EXCLUSIVE, 0, NULL, VK_IMAGE_LAYOUT_UNDEFINED };
    if (p_vkCreateImage(vd, &ic, NULL, &ws[k].src) != VK_SUCCESS) { LOG("egpu-steam-ui: import image create failed (mod 0x%llx)\n", (unsigned long long)mod); ws[k].src = 0; goto out; }
    VkMemoryFdPropertiesKHR fp = { VK_STRUCTURE_TYPE_MEMORY_FD_PROPERTIES_KHR, NULL, 0 };
    p_vkGetMemoryFdPropertiesKHR(vd, VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT, fds[0], &fp);
    VkMemoryRequirements mr; p_vkGetImageMemoryRequirements(vd, ws[k].src, &mr);
    int fd2 = dup(fds[0]);
    VkMemoryDedicatedAllocateInfo dd = { VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO, NULL, ws[k].src, VK_NULL_HANDLE };
    VkImportMemoryFdInfoKHR im = { VK_STRUCTURE_TYPE_IMPORT_MEMORY_FD_INFO_KHR, &dd, VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT, fd2 };
    VkMemoryAllocateInfo ma = { VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO, &im, mr.size, memtype(mr.memoryTypeBits & (fp.memoryTypeBits ? fp.memoryTypeBits : ~0u), 0) };
    if (p_vkAllocateMemory(vd, &ma, NULL, &ws[k].srcmem) != VK_SUCCESS) { close(fd2); p_vkDestroyImage(vd, ws[k].src, NULL); ws[k].src = 0; LOG("egpu-steam-ui: dmabuf import failed\n"); goto out; }
    p_vkBindImageMemory(vd, ws[k].src, ws[k].srcmem, 0);
    ws[k].sdev = st.st_dev; ws[k].sino = st.st_ino;
    LOG("egpu-steam-ui: imported window 0x%lx buffer %dx%d mod 0x%llx\n", (unsigned long)ws[k].win, w, h, (unsigned long long)mod);
  }
  /* 2. our copy target, shared with GL */
  if (!ws[k].dst || ws[k].gw != w || ws[k].gh != h || ws[k].gctx != ctx) {
    if (ws[k].gctx == ctx) gpu_drop_dst(k, deltex, delmem); else { ws[k].gtex = ws[k].gmem = 0; if (ws[k].dst) { p_vkDestroyImage(vd, ws[k].dst, NULL); p_vkFreeMemory(vd, ws[k].dstmem, NULL); ws[k].dst = 0; } }
    VkExternalMemoryImageCreateInfo ext = { VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_IMAGE_CREATE_INFO, NULL, VK_EXTERNAL_MEMORY_HANDLE_TYPE_OPAQUE_FD_BIT };
    VkImageCreateInfo ic = { VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO, &ext, 0, VK_IMAGE_TYPE_2D, VK_FORMAT_R8G8B8A8_UNORM, { w, h, 1 }, 1, 1, VK_SAMPLE_COUNT_1_BIT,
                             VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_SHARING_MODE_EXCLUSIVE, 0, NULL, VK_IMAGE_LAYOUT_UNDEFINED };
    if (p_vkCreateImage(vd, &ic, NULL, &ws[k].dst) != VK_SUCCESS) { ws[k].dst = 0; goto out; }
    VkMemoryRequirements mr; p_vkGetImageMemoryRequirements(vd, ws[k].dst, &mr);
    VkMemoryDedicatedAllocateInfo dd = { VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO, NULL, ws[k].dst, VK_NULL_HANDLE };
    VkExportMemoryAllocateInfo ex = { VK_STRUCTURE_TYPE_EXPORT_MEMORY_ALLOCATE_INFO, &dd, VK_EXTERNAL_MEMORY_HANDLE_TYPE_OPAQUE_FD_BIT };
    VkMemoryAllocateInfo ma = { VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO, &ex, mr.size, memtype(mr.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT) };
    if (p_vkAllocateMemory(vd, &ma, NULL, &ws[k].dstmem) != VK_SUCCESS) { p_vkDestroyImage(vd, ws[k].dst, NULL); ws[k].dst = 0; goto out; }
    p_vkBindImageMemory(vd, ws[k].dst, ws[k].dstmem, 0);
    int efd = -1; VkMemoryGetFdInfoKHR gf = { VK_STRUCTURE_TYPE_MEMORY_GET_FD_INFO_KHR, NULL, ws[k].dstmem, VK_EXTERNAL_MEMORY_HANDLE_TYPE_OPAQUE_FD_BIT };
    if (p_vkGetMemoryFdKHR(vd, &gf, &efd) != VK_SUCCESS) goto out;
    GLint one = 1; createmem(1, &ws[k].gmem); memparam(ws[k].gmem, 0x9581 /* DEDICATED_MEMORY_OBJECT */, &one);
    importfd(ws[k].gmem, mr.size, 0x9586 /* HANDLE_TYPE_OPAQUE_FD */, efd);
    gentex(1, &ws[k].gtex); bindtex(GL_TEXTURE_2D, ws[k].gtex); texpar(GL_TEXTURE_2D, 0x9580 /* TEXTURE_TILING */, 0x9584 /* OPTIMAL */);
    texstoragemem(GL_TEXTURE_2D, 1, GL_RGBA8, w, h, ws[k].gmem, 0);
    ws[k].gw = w; ws[k].gh = h; ws[k].gctx = ctx;
    LOG("egpu-steam-ui: GL-shared target %dx%d for window 0x%lx\n", w, h, (unsigned long)ws[k].win);
  }
  /* 3. GPU blit (BGRA -> RGBA) and wait */
  {
    VkCommandBufferBeginInfo bi = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO, NULL, VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT, NULL };
    p_vkResetCommandBuffer(vcb, 0); p_vkBeginCommandBuffer(vcb, &bi);
    VkImageMemoryBarrier b[2] = {
      { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, NULL, 0, VK_ACCESS_TRANSFER_READ_BIT, VK_IMAGE_LAYOUT_GENERAL, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
        VK_QUEUE_FAMILY_FOREIGN_EXT, vqf, ws[k].src, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } },
      { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, NULL, 0, VK_ACCESS_TRANSFER_WRITE_BIT, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
        VK_QUEUE_FAMILY_IGNORED, VK_QUEUE_FAMILY_IGNORED, ws[k].dst, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } } };
    p_vkCmdPipelineBarrier(vcb, VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, NULL, 0, NULL, 2, b);
    VkImageBlit rg = { { VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1 }, { { 0, 0, 0 }, { w, h, 1 } }, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1 }, { { 0, 0, 0 }, { w, h, 1 } } };
    p_vkCmdBlitImage(vcb, ws[k].src, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, ws[k].dst, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &rg, VK_FILTER_NEAREST);
    VkImageMemoryBarrier a[2] = {
      { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, NULL, VK_ACCESS_TRANSFER_READ_BIT, 0, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, VK_IMAGE_LAYOUT_GENERAL,
        vqf, VK_QUEUE_FAMILY_FOREIGN_EXT, ws[k].src, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } },
      { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, NULL, VK_ACCESS_TRANSFER_WRITE_BIT, VK_ACCESS_MEMORY_READ_BIT, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_GENERAL,
        VK_QUEUE_FAMILY_IGNORED, VK_QUEUE_FAMILY_IGNORED, ws[k].dst, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } } };
    p_vkCmdPipelineBarrier(vcb, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT, 0, 0, NULL, 0, NULL, 2, a);
    p_vkEndCommandBuffer(vcb);
    VkSubmitInfo si = { VK_STRUCTURE_TYPE_SUBMIT_INFO, NULL, 0, NULL, NULL, 1, &vcb, 0, NULL };
    p_vkResetFences(vd, 1, &vfence);
    if (p_vkQueueSubmit(vq, 1, &si, vfence) != VK_SUCCESS) goto out;
    p_vkWaitForFences(vd, 1, &vfence, VK_TRUE, 100000000ull);
  }
  ok = 1;
out:
  for (int i = 0; i < nfd; i++) close(fds[i]);
  free(br);
  return ok;
}
static int shm_read(xcb_drawable_t p, int x, int y, int w, int h) {
  size_t need = (size_t)w * h * 4;
  if (need > shmsz) {
    if (shmaddr) { xcb_shm_detach(xc, seg); shmdt(shmaddr); shmctl(shmid, IPC_RMID, 0); }
    shmid = shmget(IPC_PRIVATE, need, IPC_CREAT | 0600); shmaddr = shmat(shmid, 0, 0); shmsz = need;
    seg = xcb_generate_id(xc); xcb_shm_attach(xc, seg, shmid, 0);
  }
  xcb_shm_get_image_reply_t *r = xcb_shm_get_image_reply(xc, xcb_shm_get_image(xc, p, x, y, w, h, ~0u, XCB_IMAGE_FORMAT_Z_PIXMAP, seg, 0), NULL);
  if (!r) return -1; int depth = r->depth; free(r); return depth;
}
static void my_bind(Display *d, GLXDrawable p, int buffer, const int *attr) {
  if (passthrough) { void (*rf)(Display *, GLXDrawable, int, const int *) = rgpa("glXBindTexImageEXT"); rf(d, p, buffer, attr); return; }
  static void (*teximg)(GLenum, GLint, GLint, GLsizei, GLsizei, GLint, GLenum, GLenum, const void *);
  static void (*subimg)(GLenum, GLint, GLint, GLint, GLsizei, GLsizei, GLenum, GLenum, const void *);
  static void (*pstore)(GLenum, GLint); static void (*getiv)(GLenum, GLint *); static void (*bindbuf)(GLenum, GLuint);
  if (!teximg) { teximg = rgpa("glTexImage2D"); subimg = rgpa("glTexSubImage2D"); pstore = rgpa("glPixelStorei"); getiv = rgpa("glGetIntegerv"); bindbuf = rgpa("glBindBuffer"); }
  double t0 = now_ms();
  double ts = now_ms(); XSync(d, False); t_sync += now_ms() - ts;   /* Steam named the window pixmap on ITS connection: make sure the server has it before we read it on ours */
  pthread_mutex_lock(&mu);
  int target = GL_TEXTURE_2D, rgba = 1; Window win = 0;
  for (int i = 0; i < MAXP; i++) if (tab[i].pix == p) { target = tab[i].target; rgba = tab[i].rgba; win = tab[i].win; break; }
  if (!win) for (int i = 0; i < MAXP; i++) if (pw[i].p == p) { win = pw[i].w; break; }
  if (!xc) { xc = xcb_connect(NULL, NULL); if (xcb_connection_has_error(xc)) { LOG("egpu-steam-ui: xcb_connect failed\n"); pthread_mutex_unlock(&mu); return; }
    xcb_dri3_query_version_reply_t *dv = xcb_dri3_query_version_reply(xc, xcb_dri3_query_version(xc, 1, 2), NULL); LOG("egpu-steam-ui: DRI3 %u.%u\n", dv ? dv->major_version : 0, dv ? dv->minor_version : 0); free(dv); }
  if (!pd) { pd = XOpenDisplay(NULL); int eb, er; dmg_ok = pd && XDamageQueryExtension(pd, &eb, &er) && XFixesQueryExtension(pd, &eb, &er); LOG("egpu-steam-ui: damage tracking %s\n", dmg_ok ? "on" : "off"); }
  xcb_get_geometry_reply_t *g = xcb_get_geometry_reply(xc, xcb_get_geometry(xc, p), NULL);
  if (!g) { pthread_mutex_unlock(&mu); return; }
  int w = g->width, h = g->height; free(g);
  static void (*gentex)(GLsizei, GLuint *); static void (*bindtex)(GLenum, GLuint); static void (*texpar)(GLenum, GLenum, GLint);
  static void (*copyimg)(GLuint, GLenum, GLint, GLint, GLint, GLint, GLuint, GLenum, GLint, GLint, GLint, GLint, GLsizei, GLsizei, GLsizei);
  static void (*getlevel)(GLenum, GLint, GLenum, GLint *); static void (*deltex)(GLsizei, const GLuint *); static void *(*curctx)(void);
  if (!gentex) { gentex = rgpa("glGenTextures"); bindtex = rgpa("glBindTexture"); texpar = rgpa("glTexParameteri"); copyimg = rgpa("glCopyImageSubData");
                 getlevel = rgpa("glGetTexLevelParameteriv"); deltex = rgpa("glDeleteTextures"); curctx = rgpa("glXGetCurrentContext"); }
  GLint tex = 0; getiv(target == GL_TEXTURE_2D ? GL_TEXTURE_BINDING_2D : 0x84F6, &tex);
  void *ctx = curctx ? curctx() : NULL;
  int k = -1;
  if (win && dmg_ok && copyimg) {
    for (int i = 0; i < 64; i++) if (ws[i].win == win) { k = i; break; }
    if (k < 0) for (int i = 0; i < 64; i++) if (!ws[i].win) { k = i; ws[i].win = win; ws[i].dmg = XDamageCreate(pd, win, XDamageReportNonEmpty); ws[i].mytex = 0; break; }
  }
  while (pd && XPending(pd)) { XEvent ev; XNextEvent(pd, &ev); }
  GLint ub = 0, rl = 0, al = 4; getiv(0x88EF, &ub); getiv(GL_UNPACK_ROW_LENGTH, &rl); getiv(GL_UNPACK_ALIGNMENT, &al);
  if (ub) bindbuf(0x88EC, 0); pstore(GL_UNPACK_ROW_LENGTH, 0); pstore(GL_UNPACK_ALIGNMENT, 4);
  static int gpu_off; if (!gpu_off && getenv("EGPU_TFP_CPU")) gpu_off = 1;
  if (k >= 0 && !gpu_off && depth_of_window_ok(p) && gpu_fill(k, p, w, h, ctx)) {
    static void (*copyimg2)(GLuint, GLenum, GLint, GLint, GLint, GLint, GLuint, GLenum, GLint, GLint, GLint, GLint, GLsizei, GLsizei, GLsizei);
    if (!copyimg2) copyimg2 = rgpa("glCopyImageSubData");
    XDamageSubtract(pd, ws[k].dmg, None, None);
    bindtex(target, tex);
    GLint tw = 0, th = 0, tf = 0; getlevel(target, 0, GL_TEXTURE_WIDTH, &tw); getlevel(target, 0, GL_TEXTURE_HEIGHT, &th); getlevel(target, 0, GL_TEXTURE_INTERNAL_FORMAT, &tf);
    if (tw != w || th != h || tf != GL_RGBA8) teximg(target, 0, GL_RGBA8, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    double tc = now_ms(); copyimg2(ws[k].gtex, GL_TEXTURE_2D, 0, 0, 0, 0, tex, target, 0, 0, 0, 0, w, h, 1); t_copy += now_ms() - tc;
    n_gpu++;
  } else if (k >= 0) {
    /* our persistent copy of this window: only the damaged parts are read back from X */
    int fresh = !ws[k].mytex || ws[k].w != w || ws[k].h != h || ws[k].ctx != ctx;
    if (!ws[k].mytex) r_new++; else if (ws[k].ctx != ctx) r_ctx++; else if (ws[k].w != w || ws[k].h != h) r_size++;
    if (fresh) {
      if (ws[k].mytex && ws[k].ctx == ctx) deltex(1, &ws[k].mytex);
      XDamageSubtract(pd, ws[k].dmg, None, None);
      int depth = shm_read(p, 0, 0, w, h);
      if (depth <= 0) { ws[k].mytex = 0; goto done; }
      ws[k].fmt = (rgba && depth == 32) ? GL_RGBA8 : GL_RGB8;
      gentex(1, &ws[k].mytex); bindtex(GL_TEXTURE_2D, ws[k].mytex);
      texpar(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST); texpar(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
      teximg(GL_TEXTURE_2D, 0, ws[k].fmt, w, h, 0, GL_BGRA, GL_UNSIGNED_BYTE, shmaddr);
      ws[k].w = w; ws[k].h = h; ws[k].ctx = ctx; n_full++;
    } else {
      XserverRegion reg = XFixesCreateRegion(pd, NULL, 0); XDamageSubtract(pd, ws[k].dmg, None, reg);
      int n = 0; XRectangle *rc = XFixesFetchRegion(pd, reg, &n); XFixesDestroyRegion(pd, reg);
      if (n > 16) { int x0 = w, y0 = h, x1 = 0, y1 = 0; for (int i = 0; i < n; i++) { if (rc[i].x < x0) x0 = rc[i].x; if (rc[i].y < y0) y0 = rc[i].y; if (rc[i].x + rc[i].width > x1) x1 = rc[i].x + rc[i].width; if (rc[i].y + rc[i].height > y1) y1 = rc[i].y + rc[i].height; } rc[0].x = x0; rc[0].y = y0; rc[0].width = x1 - x0; rc[0].height = y1 - y0; n = 1; }
      if (!n) n_skip++; else n_part++;
      if (n) bindtex(GL_TEXTURE_2D, ws[k].mytex);
      for (int i = 0; i < n; i++) {
        int x = rc[i].x < 0 ? 0 : rc[i].x, y = rc[i].y < 0 ? 0 : rc[i].y, rw = rc[i].width, rh = rc[i].height;
        if (x + rw > w) rw = w - x; if (y + rh > h) rh = h - y; if (rw <= 0 || rh <= 0) continue;
        double tr = now_ms(); int ok = shm_read(p, x, y, rw, rh) > 0; t_read += now_ms() - tr; px_read += (unsigned long long)rw * rh;
        if (ok) subimg(GL_TEXTURE_2D, 0, x, y, rw, rh, GL_BGRA, GL_UNSIGNED_BYTE, shmaddr);
      }
      if (rc) XFree(rc);
    }
    /* Steam's texture: give it storage of the right size once, then a GPU-to-GPU copy */
    bindtex(target, tex);
    GLint tw = 0, th = 0, tf = 0; getlevel(target, 0, GL_TEXTURE_WIDTH, &tw); getlevel(target, 0, GL_TEXTURE_HEIGHT, &th); getlevel(target, 0, GL_TEXTURE_INTERNAL_FORMAT, &tf);
    if (tw != w || th != h || tf != ws[k].fmt) teximg(target, 0, ws[k].fmt, w, h, 0, GL_BGRA, GL_UNSIGNED_BYTE, NULL);
    double tc = now_ms(); copyimg(ws[k].mytex, GL_TEXTURE_2D, 0, 0, 0, 0, tex, target, 0, 0, 0, 0, w, h, 1); t_copy += now_ms() - tc;
  } else {
    r_nowin++;
    int depth = shm_read(p, 0, 0, w, h);
    if (depth > 0) { teximg(target, 0, (rgba && depth == 32) ? GL_RGBA8 : GL_RGB8, w, h, 0, GL_BGRA, GL_UNSIGNED_BYTE, shmaddr); n_full++; }
    else LOG("egpu-steam-ui: shm_get_image failed for 0x%lx\n", (unsigned long)p);
  }
done:
  bindtex(target, tex);
  if (ub) bindbuf(0x88EC, ub); pstore(GL_UNPACK_ROW_LENGTH, rl); pstore(GL_UNPACK_ALIGNMENT, al);
  t_sum += now_ms() - t0;
  unsigned long tot = n_full + n_part + n_skip + n_gpu;
  if (tot && tot % 36000 == 0) LOG("egpu-steam-ui: binds gpu %lu full %lu partial %lu unchanged %lu, avg %.2f ms | full because: no window %lu, new %lu, ctx %lu, size %lu | per bind: sync %.2f read %.2f copy %.2f ms, px %llu\n", n_gpu, n_full, n_part, n_skip, t_sum / tot, r_nowin, r_new, r_ctx, r_size, t_sync / tot, t_read / tot, t_copy / tot, px_read / tot);
  pthread_mutex_unlock(&mu);
}
static void my_release(Display *d, GLXDrawable p, int buffer) {
  if (passthrough) { void (*rf)(Display *, GLXDrawable, int) = rgpa("glXReleaseTexImageEXT"); rf(d, p, buffer); return; }}

static void *mine(const char *n) {
  if (!strcmp(n, "glXQueryExtensionsString")) return (void *)my_qes;
  if (!strcmp(n, "glXChooseFBConfig")) return (void *)my_choose;
  if (!strcmp(n, "glXGetFBConfigAttrib")) return (void *)my_getattr;
  if (!strcmp(n, "glXCreatePixmap")) return (void *)my_create;
  if (!strcmp(n, "glXDestroyPixmap")) return (void *)my_destroy;
  if (!strcmp(n, "glXBindTexImageEXT")) return (void *)my_bind;
  if (!strcmp(n, "glXReleaseTexImageEXT")) return (void *)my_release;
  return NULL;
}
static void *my_gpa(const GLubyte *n) { void *m = mine((const char *)n); return m ? m : rgpa((const char *)n); }

void *dlsym(void *h, const char *n) {
  dlsym_fn d = rdlsym();
  if (n && n[0] == 'g' && n[1] == 'l' && n[2] == 'X' && on()) {
    if (!strcmp(n, "glXGetProcAddressARB") || !strcmp(n, "glXGetProcAddress")) { if (!real_gpa) real_gpa = (gpa_fn)d(h, n); return (void *)my_gpa; }
    void *m = mine(n); if (m) return m;
  }
  return d(h, n);
}
