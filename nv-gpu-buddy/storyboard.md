# NV GPU Buddy narrated presentation

## 1. NV GPU Buddy

0.000–19.458 seconds

This is NV GPU Buddy, an experimental mode of EGPU Buddy for desktop PCs and laptops with a built-in NVIDIA card. It brings the app’s NVIDIA controls and desktop experience to those machines. Handhelds with external graphics use the regular EGPU Buddy mode.

Visual: Desktop PC or laptop • built-in NVIDIA GPU

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 2. Who this mode is for

19.458–41.542 seconds

It targets NVIDIA-equipped desktop PCs and laptops running SteamOS, CachyOS or Bazzite in Game Mode. There is also a card-coming option for a desktop PC that will receive an NVIDIA card later. Handhelds always use the normal EGPU Buddy install. This mode has not yet been hardware-tested on a PC or laptop.

Visual: PC / laptop only • no handheld eligibility
Experimental and not yet tested on target hardware

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 3. What it keeps

41.542–59.333 seconds

The mode retains the Decky plugin and desktop app, NVIDIA game settings, power and clock controls, live readings, the Big Art menu fix, screens, best resolution, support reports and updates. Available controls still depend on the card and session.

Visual: NVIDIA settings • power / clocks • desktop app
Screens • reports • updates

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 4. Built-in graphics changes the job

59.333–76.792 seconds

A built-in graphics card does not need an eGPU attach or Safe Detach flow. This installer leaves out the eGPU hot-plug rules, dock tools, eGPU boot policy and eGPU session. It does not force a built-in card to behave like an external one.

Visual: No eGPU hot-plug / Safe Detach UI
No dock tools or force-external GPU setting

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 5. The project’s patched NVIDIA driver

76.792–98.750 seconds

NV GPU Buddy uses this project’s patched NVIDIA driver, with its userspace kept at the matching version. It does not simply use the distro’s existing NVIDIA driver. On Bazzite, choose an image without a built-in NVIDIA driver before installation. The mode does not make eGPU removal promises for the built-in card.

Visual: Patched project driver + matching userspace
Bazzite: non-NVIDIA image required

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 6. Start with the Decky plugin

98.750–118.125 seconds

With Decky Loader already installed, add the same EGPU Buddy plugin ZIP using Decky’s Developer settings. Then open Install system integration. Eligible desktop PCs and laptops are offered the NV GPU Buddy mode. Handhelds use the regular EGPU Buddy installation.

Visual: Same plugin ZIP → Install system integration

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 7. Choose NV GPU Buddy

118.125–139.750 seconds

On an eligible desktop or laptop, the plugin offers NV GPU Buddy experimental, Normal eGPU install, or Cancel. Read the offer and choose the experimental mode only for the intended built-in NVIDIA setup. A desktop without a card can install its driver ahead of fitting the card while powered off.

Visual: Eligible machine offer • opt in explicitly

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 8. Confirm this is not a handheld

139.750–153.458 seconds

A second confirmation explicitly asks whether this is a desktop PC or a laptop. Confirm only if that is true. This extra gate helps prevent handheld users taking the wrong installation path.

Visual: Confirm: not a handheld

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 9. Review and install the integration

153.458–174.042 seconds

Review the final installation confirmation and any risk notice before continuing. NV GPU Buddy replaces the NVIDIA driver with this project’s patched version. This shared confirmation currently mentions some eGPU components, although the dedicated NV GPU Buddy installer leaves those components out.

Visual: Final confirmation • shared summary wording caveat

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 10. The interface becomes NV GPU Buddy

174.042–194.375 seconds

After a successful mode install, the plugin and desktop app are named NV GPU Buddy. The main panel exposes NVIDIA controls instead of eGPU attachment actions. The values in this source-rendered capture are mocked, not evidence of a successful installation or performance result.

Visual: NV GPU Buddy mode UI • mocked hardware readings

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 11. NVIDIA settings in both interfaces

194.375–211.833 seconds

The NVIDIA settings page carries game options such as latency, V-sync, frame limits and shader-cache choices. The same settings are available in the desktop app. Compatibility and whether a game actually receives an option still matter.

Visual: Plugin + desktop app • game-dependent settings

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 12. Its own update selection

211.833–233.125 seconds

The mode follows releases marked NV GPU Buddy in their notes. eGPU-only dock and hot-plug changes are not its update channel. OS-update repair is included. On SteamOS, changes that cannot replace an in-use NVIDIA driver may be staged until reboot; follow the displayed status.

Visual: Only releases marked “NV GPU Buddy”
In-use driver updates may stage for reboot

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches

## 13. Experimental, ready for testers

233.125–251.458 seconds

NV GPU Buddy builds on the same project and community work. The target PC and laptop hardware path still needs testing. Read the current instructions and release notes, then send a support report if you test it. The project and Discord links are below.

Visual: github.com/denver8989/EGPU-Buddy
Credits: Decky, LACT, NVIDIA patch and gamescope contributors

Source: README.md NV GPU Buddy; install-nv-gpu-buddy.sh; frontend track branches
