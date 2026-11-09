# Narration in your own voice

The narration is ready as one UTF-8 text file per chapter in `narration/`. `narration-manifest.json` links each text file to its chapter, time range and future WAV filename. The opening footage chapter is deliberately excluded from generated narration. The NV GPU Buddy presentation has its own manifest and text directory.

Local generation tool: [Qwen3-TTS Base](https://github.com/QwenLM/Qwen3-TTS). Qwen3-TTS 1.7B Base is installed in an isolated local environment alongside the voice recorder. The user’s sample stays local. Generated chapter audio is saved in `audio/`.

The user has recorded a 30-second sample of their own voice, with a locally checked transcript. For future replacement samples, record 20–30 clean seconds with matching words. Use a quiet room, a steady microphone distance, and your intended narration pace. Leave out music, reverb effects and noise processing that changes your voice. Keep the original WAV and the exact words, including any pauses or corrections you decide to retain.

Before generating the full film, test one short passage containing the names you need: EGPU Buddy, NV GPU Buddy, Decky, CachyOS, Bazzite, NVIDIA, Legion Go, Victor Borges and USB4. Choose your preferred spoken forms. In speech-only copies, use spaced letters for acronyms when helpful, for example “E G P U” or “U S B four”. Keep the visible slides and canonical script unchanged. Record unfamiliar names yourself as a pronunciation reference rather than assuming an accent or phonetic spelling.

Generate one lossless audio file per chapter after the sample sounds right. Put files at the `audio/NN.wav` destinations named in the manifest. Listen to every chapter, fix skipped words and names, and measure each clip's duration. The current timings are an editorial guide, not a forced target. Extend scene holds to the actual voice rather than rushing it. Add your opening footage, then align captions and the few transition beats to the final audio. The narrated HTML embeds final chapter MP3s. Play enables speech, seeking and chapter selection keep it aligned, and chapter changes stay synchronized. The separate four-second-per-chapter MP4 remains a silent review cut.

A final tutorial recording can replace the clearly marked source-rendered screenshots. Keep the same order of warning, picker, confirmation and system integration. Do not use a working live install merely to create a simulated success result.

Recorded reference: `/home/deck/Desktop/EGPU-Buddy-Voice-Recording/voice-sample-20261109-104431.wav`. A louder listening copy is beside it. Signal checks passed without clipping; the exact spoken transcript still needs listening verification before voice generation.

Pronunciation copies are in `narration-spoken/`; the canonical narration text is preserved. Checks use local Whisper transcription and signal measurements. These automated checks do not establish that every pronunciation or voice inflection is ideal; review the generated draft before publication.

Revision 06 plays a single continuous narration master, with only about 80–120 ms added between chapters. Chapter changes do not replace or restart the audio source. Original chapter WAV masters are retained. The owner-supplied SciFi track remains on beneath speech.

The real opening is now included before generated speech. The SciFi background master spans the entire edited runtime; presentation music starts at master offset 78.5 seconds so the intro handoff continues the same passage.

Player controls update: Quick review and the background-music toggle have been removed. Background music remains on beneath speech.
