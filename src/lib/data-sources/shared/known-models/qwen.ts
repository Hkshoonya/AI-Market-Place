import type { KnownModelMeta } from "../build-record";

export const QWEN_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "qwen3-tts": {
    name: "Qwen3-TTS",
    description:
      "Qwen open-weight text-to-speech model family for voice cloning, voice design, low-latency streaming generation, and multilingual speech synthesis.",
    category: "speech_audio",
    release_date: "2026-04-02",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
    website_url: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
  },
};
