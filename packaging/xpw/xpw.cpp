// libxpw: the display-GPU side of SteamOS EGPU Buddy's handheld passthrough (eGPU renders, a screen driven by the
// handheld's own GPU shows it). Loaded by the patched gamescope (GAMESCOPE_XGPU_LIB); C interface, one frame at a time.
//   M3 "pyrowave": PyroWave (Themaister, MIT) encodes on the eGPU, ~0.5 MB/frame to RAM, decodes on the display GPU,
//                  conv.comp writes RGBA into the display GPU's scanout buffer.
//   M2 "copy":     the eGPU copies the frame into page-aligned RAM; the display GPU imports it and copies it in.
// Neither GPU ever writes memory owned by the other.
#include <vulkan/vulkan.h>
#include "pyrowave.h"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <unistd.h>

static const uint32_t conv_spv[] = {
#include "conv.inc"
};

#define LOG(...) fprintf(stderr, "[xpw] " __VA_ARGS__)
#define PW(x) do { pyrowave_result r_ = (x); if (r_ != PYROWAVE_SUCCESS) { LOG("%s failed: %d\n", #x, r_); return -1; } } while (0)
#define VK(x) do { VkResult r_ = (x); if (r_ != VK_SUCCESS) { LOG("%s failed: %d\n", #x, r_); return -1; } } while (0)

static int W, H; static size_t BYTES;
static pyrowave_device enc_dev, dec_dev; static pyrowave_encoder enc; static pyrowave_decoder dec;
static VkDevice dd; static VkPhysicalDevice dpd; static VkQueue dq; static uint32_t dfam;
static VkImage planes[3]; static VkImageView plane_views[3];
static VkSemaphore dec_done; static uint64_t dec_value;   // timeline: decoder release -> conversion
static VkDescriptorSetLayout dsl; static VkPipelineLayout pl; static VkPipeline conv_pipe; static VkDescriptorPool dpool;
static VkCommandPool cpool; static VkCommandBuffer cmd; static VkFence fence;
struct Scanout { pyrowave_image img; VkImageView view; VkDescriptorSet set; };
static Scanout scanout[3];
static uint8_t *bitstream;
static double t_enc, t_dec, t_n, t_max; static uint64_t frames;

static VkImageCreateInfo dmabuf_ci(VkFormat fmt, VkImageUsageFlags usage, VkImageDrmFormatModifierExplicitCreateInfoEXT *mx, VkSubresourceLayout *pl0,
                                   uint64_t mod, uint32_t stride, uint32_t offset) {
  *pl0 = { offset, 0, stride, 0, 0 };
  *mx = { VK_STRUCTURE_TYPE_IMAGE_DRM_FORMAT_MODIFIER_EXPLICIT_CREATE_INFO_EXT, nullptr, mod, 1, pl0 };
  VkImageCreateInfo ci = { VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO, mx, 0, VK_IMAGE_TYPE_2D, fmt, { (uint32_t)W, (uint32_t)H, 1 }, 1, 1,
                           VK_SAMPLE_COUNT_1_BIT, VK_IMAGE_TILING_DRM_FORMAT_MODIFIER_EXT, usage, VK_SHARING_MODE_EXCLUSIVE, 0, nullptr, VK_IMAGE_LAYOUT_UNDEFINED };
  return ci;
}

static VkImageView mkview(VkImage img, VkFormat fmt) {
  VkImageViewCreateInfo vi = { VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO, nullptr, 0, img, VK_IMAGE_VIEW_TYPE_2D, fmt, {},
                               { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };
  VkImageView v = VK_NULL_HANDLE; vkCreateImageView(dd, &vi, nullptr, &v); return v;
}

static bool raw_mode;

// Raw (M2) mode: no codec. The caller has the eGPU copy each frame into page-aligned RAM; the display GPU imports that
// RAM and copies it into its own scanout buffer. Neither GPU ever touches memory owned by the other.
extern "C" int xpw_init_raw(int w, int h) {
  W = w; H = h; raw_mode = true;
  PW(pyrowave_create_device_by_compat(0x1002, 0, nullptr, nullptr, nullptr, VK_QUEUE_GLOBAL_PRIORITY_MEDIUM, &dec_dev));
  VkInstance di; pyrowave_device_get_vk_device_handles(dec_dev, &di, &dpd, &dd);
  uint32_t nf = 0; vkGetPhysicalDeviceQueueFamilyProperties(dpd, &nf, nullptr);
  VkQueueFamilyProperties qf[16]; nf = nf > 16 ? 16 : nf; vkGetPhysicalDeviceQueueFamilyProperties(dpd, &nf, qf);
  for (dfam = 0; dfam < nf && !(qf[dfam].queueFlags & VK_QUEUE_COMPUTE_BIT && qf[dfam].queueFlags & VK_QUEUE_GRAPHICS_BIT); dfam++) {}
  vkGetDeviceQueue(dd, dfam, 0, &dq);
  VkCommandPoolCreateInfo cpci = { VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO, nullptr, VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT, dfam };
  VK(vkCreateCommandPool(dd, &cpci, nullptr, &cpool));
  VkCommandBufferAllocateInfo cai = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO, nullptr, cpool, VK_COMMAND_BUFFER_LEVEL_PRIMARY, 1 }; VK(vkAllocateCommandBuffers(dd, &cai, &cmd));
  VkFenceCreateInfo fci = { VK_STRUCTURE_TYPE_FENCE_CREATE_INFO }; VK(vkCreateFence(dd, &fci, nullptr, &fence));
  LOG("ready (raw copy): %dx%d, display-GPU queue family %u\n", w, h, dfam);
  return 0;
}

// raw: frame (RGBA8, tightly packed W*H*4) in page-aligned RAM -> scanout buffer i
extern "C" int xpw_frame_host(void *ptr, size_t size, int i) {
  auto t0 = std::chrono::steady_clock::now();
  static VkBuffer hbuf; static void *hptr;
  if (hptr != ptr) {
    static PFN_vkGetMemoryHostPointerPropertiesEXT getp = (PFN_vkGetMemoryHostPointerPropertiesEXT)vkGetDeviceProcAddr(dd, "vkGetMemoryHostPointerPropertiesEXT");
    VkMemoryHostPointerPropertiesEXT hp = { VK_STRUCTURE_TYPE_MEMORY_HOST_POINTER_PROPERTIES_EXT };
    if (!getp) { LOG("host-pointer import not available on the display GPU\n"); return -1; }
    VK(getp(dd, VK_EXTERNAL_MEMORY_HANDLE_TYPE_HOST_ALLOCATION_BIT_EXT, ptr, &hp));
    VkExternalMemoryBufferCreateInfo eb = { VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_BUFFER_CREATE_INFO, nullptr, VK_EXTERNAL_MEMORY_HANDLE_TYPE_HOST_ALLOCATION_BIT_EXT };
    VkBufferCreateInfo bci = { VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO, &eb, 0, size, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_SHARING_MODE_EXCLUSIVE };
    VK(vkCreateBuffer(dd, &bci, nullptr, &hbuf));
    uint32_t t = 0; while (t < 32 && !((hp.memoryTypeBits >> t) & 1)) t++;
    VkImportMemoryHostPointerInfoEXT imp = { VK_STRUCTURE_TYPE_IMPORT_MEMORY_HOST_POINTER_INFO_EXT, nullptr, VK_EXTERNAL_MEMORY_HANDLE_TYPE_HOST_ALLOCATION_BIT_EXT, ptr };
    VkMemoryAllocateInfo ai = { VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO, &imp, size, t }; VkDeviceMemory m;
    VK(vkAllocateMemory(dd, &ai, nullptr, &m)); VK(vkBindBufferMemory(dd, hbuf, m, 0));
    hptr = ptr; LOG("imported the frame RAM block (%zu bytes)\n", size);
  }
  VkImage simg = pyrowave_image_get_handle(scanout[i].img);
  VkCommandBufferBeginInfo bi = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO, nullptr, VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT };
  VK(vkResetCommandBuffer(cmd, 0)); VK(vkBeginCommandBuffer(cmd, &bi));
  VkImageMemoryBarrier b = { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, nullptr, 0, VK_ACCESS_TRANSFER_WRITE_BIT, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
                             VK_QUEUE_FAMILY_FOREIGN_EXT, dfam, simg, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };
  vkCmdPipelineBarrier(cmd, VK_PIPELINE_STAGE_HOST_BIT | VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &b);
  VkBufferImageCopy rg = { 0, 0, 0, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1 }, { 0, 0, 0 }, { (uint32_t)W, (uint32_t)H, 1 } };
  vkCmdCopyBufferToImage(cmd, hbuf, simg, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &rg);
  VkImageMemoryBarrier back = { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, nullptr, VK_ACCESS_TRANSFER_WRITE_BIT, 0, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_GENERAL,
                                dfam, VK_QUEUE_FAMILY_FOREIGN_EXT, simg, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };
  vkCmdPipelineBarrier(cmd, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT, 0, 0, nullptr, 0, nullptr, 1, &back);
  VK(vkEndCommandBuffer(cmd));
  VkSubmitInfo si = { VK_STRUCTURE_TYPE_SUBMIT_INFO, nullptr, 0, nullptr, nullptr, 1, &cmd };
  VK(vkQueueSubmit(dq, 1, &si, fence)); VK(vkWaitForFences(dd, 1, &fence, VK_TRUE, UINT64_MAX)); VK(vkResetFences(dd, 1, &fence));
  double d = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  t_dec += d; t_max = std::max(t_max, d); t_n++;
  if (++frames % 1800 == 0) { LOG("%lu frames (raw): display-GPU copy %.2f ms avg, max %.2f ms\n", (unsigned long)frames, t_dec / t_n, t_max); t_dec = t_n = t_max = 0; }
  return 0;
}

extern "C" int xpw_init(int w, int h, size_t bytes) {
  W = w; H = h; BYTES = bytes;
  // encoder on the eGPU (high priority compute), decoder on the display GPU: picked by PCI vendor, not by model
  PW(pyrowave_create_device_by_compat(0x10de, 0, nullptr, nullptr, nullptr, VK_QUEUE_GLOBAL_PRIORITY_HIGH, &enc_dev));
  PW(pyrowave_create_device_by_compat(0x1002, 0, nullptr, nullptr, nullptr, VK_QUEUE_GLOBAL_PRIORITY_MEDIUM, &dec_dev));
  pyrowave_encoder_create_info eci = { enc_dev, w, h, PYROWAVE_CHROMA_SUBSAMPLING_444 };
  PW(pyrowave_encoder_create(&eci, &enc));
  pyrowave_decoder_create_info dci = { dec_dev, w, h, PYROWAVE_CHROMA_SUBSAMPLING_444, false };
  PW(pyrowave_decoder_create(&dci, &dec));
  bitstream = new uint8_t[bytes + 65536];

  // display-GPU side: plane images, conversion pipeline, queue
  VkInstance di; pyrowave_device_get_vk_device_handles(dec_dev, &di, &dpd, &dd);
  uint32_t nf = 0; vkGetPhysicalDeviceQueueFamilyProperties(dpd, &nf, nullptr);
  VkQueueFamilyProperties qf[16]; nf = nf > 16 ? 16 : nf; vkGetPhysicalDeviceQueueFamilyProperties(dpd, &nf, qf);
  for (dfam = 0; dfam < nf && !(qf[dfam].queueFlags & VK_QUEUE_COMPUTE_BIT && qf[dfam].queueFlags & VK_QUEUE_GRAPHICS_BIT); dfam++) {}
  vkGetDeviceQueue(dd, dfam, 0, &dq);   // ponytail: shares Granite's graphics queue; all calls are on one thread
  VkPhysicalDeviceMemoryProperties mp; vkGetPhysicalDeviceMemoryProperties(dpd, &mp);
  for (int i = 0; i < 3; i++) {
    VkImageCreateInfo ci = { VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO, nullptr, 0, VK_IMAGE_TYPE_2D, VK_FORMAT_R8_UNORM, { (uint32_t)w, (uint32_t)h, 1 }, 1, 1,
                             VK_SAMPLE_COUNT_1_BIT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_STORAGE_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_SHARING_MODE_EXCLUSIVE, 0, nullptr, VK_IMAGE_LAYOUT_UNDEFINED };
    VK(vkCreateImage(dd, &ci, nullptr, &planes[i]));
    VkMemoryRequirements mr; vkGetImageMemoryRequirements(dd, planes[i], &mr);
    uint32_t t = 0; while (!((mr.memoryTypeBits >> t) & 1) || !(mp.memoryTypes[t].propertyFlags & VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT)) t++;
    VkMemoryAllocateInfo ai = { VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO, nullptr, mr.size, t }; VkDeviceMemory m;
    VK(vkAllocateMemory(dd, &ai, nullptr, &m)); VK(vkBindImageMemory(dd, planes[i], m, 0));
    plane_views[i] = mkview(planes[i], VK_FORMAT_R8_UNORM);
  }
  VkSemaphoreTypeCreateInfo stci = { VK_STRUCTURE_TYPE_SEMAPHORE_TYPE_CREATE_INFO, nullptr, VK_SEMAPHORE_TYPE_TIMELINE, 0 };
  VkSemaphoreCreateInfo semci = { VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO, &stci, 0 };
  VK(vkCreateSemaphore(dd, &semci, nullptr, &dec_done));

  VkDescriptorSetLayoutBinding b[4]; for (uint32_t i = 0; i < 4; i++) b[i] = { i, VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, 1, VK_SHADER_STAGE_COMPUTE_BIT, nullptr };
  VkDescriptorSetLayoutCreateInfo dl = { VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO, nullptr, 0, 4, b }; VK(vkCreateDescriptorSetLayout(dd, &dl, nullptr, &dsl));
  VkPipelineLayoutCreateInfo pli = { VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO, nullptr, 0, 1, &dsl }; VK(vkCreatePipelineLayout(dd, &pli, nullptr, &pl));
  VkShaderModuleCreateInfo smi = { VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO, nullptr, 0, sizeof conv_spv, conv_spv }; VkShaderModule sm;
  VK(vkCreateShaderModule(dd, &smi, nullptr, &sm));
  VkComputePipelineCreateInfo cpi = { VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO, nullptr, 0,
                                      { VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO, nullptr, 0, VK_SHADER_STAGE_COMPUTE_BIT, sm, "main", nullptr }, pl };
  VK(vkCreateComputePipelines(dd, VK_NULL_HANDLE, 1, &cpi, nullptr, &conv_pipe));
  VkDescriptorPoolSize ps = { VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, 12 };
  VkDescriptorPoolCreateInfo dpi = { VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO, nullptr, 0, 3, 1, &ps }; VK(vkCreateDescriptorPool(dd, &dpi, nullptr, &dpool));
  VkCommandPoolCreateInfo cpci = { VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO, nullptr, VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT, dfam };
  VK(vkCreateCommandPool(dd, &cpci, nullptr, &cpool));
  VkCommandBufferAllocateInfo cai = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO, nullptr, cpool, VK_COMMAND_BUFFER_LEVEL_PRIMARY, 1 }; VK(vkAllocateCommandBuffers(dd, &cai, &cmd));
  VkFenceCreateInfo fci = { VK_STRUCTURE_TYPE_FENCE_CREATE_INFO }; VK(vkCreateFence(dd, &fci, nullptr, &fence));

  // planes to GENERAL once
  VkCommandBufferBeginInfo bi = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO, nullptr, VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT };
  VK(vkBeginCommandBuffer(cmd, &bi));
  for (int i = 0; i < 3; i++) {
    VkImageMemoryBarrier ib = { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, nullptr, 0, VK_ACCESS_SHADER_WRITE_BIT, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_GENERAL,
                                VK_QUEUE_FAMILY_IGNORED, VK_QUEUE_FAMILY_IGNORED, planes[i], { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };
    vkCmdPipelineBarrier(cmd, VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, 0, 0, nullptr, 0, nullptr, 1, &ib);
  }
  VK(vkEndCommandBuffer(cmd));
  VkSubmitInfo si = { VK_STRUCTURE_TYPE_SUBMIT_INFO, nullptr, 0, nullptr, nullptr, 1, &cmd };
  VK(vkQueueSubmit(dq, 1, &si, fence)); VK(vkWaitForFences(dd, 1, &fence, VK_TRUE, UINT64_MAX)); VK(vkResetFences(dd, 1, &fence));
  LOG("ready: %dx%d 4:4:4, %zu bytes/frame, decoder queue family %u\n", w, h, bytes, dfam);
  return 0;
}

// display GPU's scanout buffer i (RGBA8 byte order = DRM XBGR8888), imported once
extern "C" int xpw_set_scanout(int i, int fd, uint32_t stride, uint32_t offset, uint64_t modifier) {
  VkImageDrmFormatModifierExplicitCreateInfoEXT mx; VkSubresourceLayout l0;
  VkImageCreateInfo ci = dmabuf_ci(VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_USAGE_STORAGE_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT, &mx, &l0, modifier, stride, offset);
  pyrowave_image_create_info ii = { dec_dev, (pyrowave_os_handle)dup(fd), VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT, &ci };
  PW(pyrowave_image_create(&ii, &scanout[i].img));
  if (raw_mode) { scanout[i].view = VK_NULL_HANDLE; return 0; }   // raw mode: no conversion pipeline
  scanout[i].view = mkview(pyrowave_image_get_handle(scanout[i].img), VK_FORMAT_R8G8B8A8_UNORM);
  VkDescriptorSetAllocateInfo dai = { VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO, nullptr, dpool, 1, &dsl }; VK(vkAllocateDescriptorSets(dd, &dai, &scanout[i].set));
  VkDescriptorImageInfo di[4]; VkWriteDescriptorSet wr[4];
  for (int k = 0; k < 4; k++) {
    di[k] = { VK_NULL_HANDLE, k < 3 ? plane_views[k] : scanout[i].view, VK_IMAGE_LAYOUT_GENERAL };
    wr[k] = { VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET, nullptr, scanout[i].set, (uint32_t)k, 0, 1, VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, &di[k], nullptr, nullptr };
  }
  vkUpdateDescriptorSets(dd, 4, wr, 0, nullptr);
  return 0;
}

static int encode_decode(pyrowave_image gimg, uint32_t qfam, int i, std::chrono::steady_clock::time_point t0);

// Input = an RGBA8 image the caller allocated on the eGPU (OPTIMAL tiling, usage TRANSFER_DST|SAMPLED) and exported
// as an OPAQUE_FD. Same driver, same GPU: no DRM-modifier interpretation involved (importing the game's own tiled
// dmabufs into a second device faulted the GPU: Xid 13). The caller copies each frame into it, then calls this.
extern "C" int xpw_frame_opaque(int mem_fd, int i) {
  auto t0 = std::chrono::steady_clock::now();
  static pyrowave_image src;
  if (!src) {
    VkExternalMemoryImageCreateInfo em = { VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_IMAGE_CREATE_INFO, nullptr, VK_EXTERNAL_MEMORY_HANDLE_TYPE_OPAQUE_FD_BIT };
    VkImageCreateInfo ci = { VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO, &em, 0, VK_IMAGE_TYPE_2D, VK_FORMAT_R8G8B8A8_UNORM, { (uint32_t)W, (uint32_t)H, 1 }, 1, 1,
                             VK_SAMPLE_COUNT_1_BIT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT,
                             VK_SHARING_MODE_EXCLUSIVE, 0, nullptr, VK_IMAGE_LAYOUT_UNDEFINED };
    pyrowave_image_create_info ii = { enc_dev, (pyrowave_os_handle)dup(mem_fd), VK_EXTERNAL_MEMORY_HANDLE_TYPE_OPAQUE_FD_BIT, &ci };
    PW(pyrowave_image_create(&ii, &src));
    LOG("imported the encoder input image (opaque fd)\n");
  }
  return encode_decode(src, VK_QUEUE_FAMILY_EXTERNAL, i, t0);
}

static int encode_decode(pyrowave_image gimg, uint32_t qfam, int i, std::chrono::steady_clock::time_point t0) {
  // encode on the eGPU (RGB -> YCbCr 4:4:4 inside PyroWave), borrow the game buffer from its owner and give it back
  pyrowave_gpu_external_reference ref = { gimg, qfam };
  pyrowave_gpu_sync_operation acq = { &ref, 1, {} }, rel = { &ref, 1, {} };
  pyrowave_scaled_encode_info sei = {};
  PW(pyrowave_image_get_image_view(gimg, VK_IMAGE_ASPECT_COLOR_BIT, VK_IMAGE_USAGE_SAMPLED_BIT, &sei.view));
  sei.view.layout = VK_IMAGE_LAYOUT_GENERAL;
  sei.input_color_space = VK_COLOR_SPACE_SRGB_NONLINEAR_KHR; sei.output_color_space = VK_COLOR_SPACE_SRGB_NONLINEAR_KHR;
  sei.intermediate_plane_format = VK_FORMAT_R8_UNORM; sei.ycbcr_chroma_midpoint = 0.5f; sei.force_linear_filtering = true;
  pyrowave_rate_control rc = { BYTES };
  PW(pyrowave_encoder_encode_gpu_scaled(enc, &acq, &rel, &sei, &rc));
  pyrowave_packet pk; size_t np = 0;
  PW(pyrowave_encoder_packetize(enc, &pk, BYTES + 65536, &np, bitstream, BYTES + 65536));   // waits for the eGPU, bitstream now in RAM
  auto t1 = std::chrono::steady_clock::now();

  // decode on the display GPU, then convert into the scanout buffer
  pyrowave_decoder_clear(dec);
  PW(pyrowave_decoder_push_packet(dec, bitstream + pk.offset, pk.size));
  if (!pyrowave_decoder_decode_is_ready(dec, false)) { LOG("decoder not ready\n"); return -1; }
  pyrowave_gpu_buffers bufs = {};
  for (int k = 0; k < 3; k++)
    bufs.planes[k] = { planes[k], (uint32_t)W, (uint32_t)H, VK_FORMAT_R8_UNORM, VK_FORMAT_R8_UNORM, 0, 0, VK_IMAGE_ASPECT_COLOR_BIT, VK_COMPONENT_SWIZZLE_IDENTITY, VK_IMAGE_LAYOUT_GENERAL };
  pyrowave_gpu_sync_operation drel = { nullptr, 0, { dec_done, ++dec_value } };
  PW(pyrowave_decoder_decode_gpu_buffer(dec, nullptr, &drel, &bufs));

  VkImage simg = pyrowave_image_get_handle(scanout[i].img);
  VkCommandBufferBeginInfo bi = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO, nullptr, VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT };
  VK(vkResetCommandBuffer(cmd, 0)); VK(vkBeginCommandBuffer(cmd, &bi));
  VkImageMemoryBarrier b[4];
  for (int k = 0; k < 3; k++)   // decoder writes visible to the conversion
    b[k] = { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, nullptr, VK_ACCESS_SHADER_WRITE_BIT, VK_ACCESS_SHADER_READ_BIT, VK_IMAGE_LAYOUT_GENERAL, VK_IMAGE_LAYOUT_GENERAL,
             VK_QUEUE_FAMILY_IGNORED, VK_QUEUE_FAMILY_IGNORED, planes[k], { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };
  b[3] = { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, nullptr, 0, VK_ACCESS_SHADER_WRITE_BIT, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_GENERAL,
           VK_QUEUE_FAMILY_FOREIGN_EXT, dfam, simg, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };   // whole buffer rewritten: discard
  vkCmdPipelineBarrier(cmd, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT | VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, 0, 0, nullptr, 0, nullptr, 4, b);
  vkCmdBindPipeline(cmd, VK_PIPELINE_BIND_POINT_COMPUTE, conv_pipe);
  vkCmdBindDescriptorSets(cmd, VK_PIPELINE_BIND_POINT_COMPUTE, pl, 0, 1, &scanout[i].set, 0, nullptr);
  vkCmdDispatch(cmd, (W + 7) / 8, (H + 7) / 8, 1);
  VkImageMemoryBarrier back = { VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER, nullptr, VK_ACCESS_SHADER_WRITE_BIT, 0, VK_IMAGE_LAYOUT_GENERAL, VK_IMAGE_LAYOUT_GENERAL,
                                dfam, VK_QUEUE_FAMILY_FOREIGN_EXT, simg, { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 } };   // hand it to the display
  vkCmdPipelineBarrier(cmd, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT, 0, 0, nullptr, 0, nullptr, 1, &back);
  VK(vkEndCommandBuffer(cmd));
  VkSemaphore ws = dec_done; VkPipelineStageFlags wst = VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT;
  VkTimelineSemaphoreSubmitInfo tl = { VK_STRUCTURE_TYPE_TIMELINE_SEMAPHORE_SUBMIT_INFO, nullptr, 1, &dec_value, 0, nullptr };
  VkSubmitInfo si = { VK_STRUCTURE_TYPE_SUBMIT_INFO, &tl, 1, &ws, &wst, 1, &cmd };
  VK(vkQueueSubmit(dq, 1, &si, fence)); VK(vkWaitForFences(dd, 1, &fence, VK_TRUE, UINT64_MAX)); VK(vkResetFences(dd, 1, &fence));
  auto t2 = std::chrono::steady_clock::now();

  double e = std::chrono::duration<double, std::milli>(t1 - t0).count(), d = std::chrono::duration<double, std::milli>(t2 - t1).count();
  t_enc += e; t_dec += d; t_max = std::max(t_max, e + d); t_n++;
  if (++frames % 600 == 0) {
    LOG("%lu frames: eGPU encode+bitstream %.2f ms, display-GPU decode+convert %.2f ms, total max %.2f ms, last frame %zu bytes\n",
        (unsigned long)frames, t_enc / t_n, t_dec / t_n, t_max, pk.size);
    t_enc = t_dec = t_n = t_max = 0;
  }
  return 0;
}
