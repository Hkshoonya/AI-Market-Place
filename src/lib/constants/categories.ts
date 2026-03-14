import {
  MessageSquare,
  Image,
  Eye,
  Layers,
  Binary,
  Mic,
  Video,
  Code,
  Globe,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type ModelCategory =
  | "llm"
  | "image_generation"
  | "vision"
  | "multimodal"
  | "embeddings"
  | "speech_audio"
  | "video"
  | "code"
  | "agentic_browser"
  | "specialized";

export interface CategoryConfig {
  slug: ModelCategory;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    slug: "llm",
    label: "Large Language Models",
    shortLabel: "LLMs",
    icon: MessageSquare,
    description: "Text generation and understanding",
    color: "#00d4aa",
  },
  {
    slug: "image_generation",
    label: "Image Generation",
    shortLabel: "Image Gen",
    icon: Image,
    description: "Text-to-image and image editing",
    color: "#f59e0b",
  },
  {
    slug: "vision",
    label: "Vision & Image",
    shortLabel: "Vision",
    icon: Eye,
    description: "Image understanding and classification",
    color: "#f59e0b",
  },
  {
    slug: "multimodal",
    label: "Multimodal",
    shortLabel: "Multimodal",
    icon: Layers,
    description: "Text, image, audio, and video combined",
    color: "#ec4899",
  },
  {
    slug: "embeddings",
    label: "Embeddings",
    shortLabel: "Embeddings",
    icon: Binary,
    description: "Text and multimodal embeddings",
    color: "#78716c",
  },
  {
    slug: "speech_audio",
    label: "Speech & Audio",
    shortLabel: "Speech",
    icon: Mic,
    description: "Speech-to-text, TTS, and audio analysis",
    color: "#14b8a6",
  },
  {
    slug: "video",
    label: "Video",
    shortLabel: "Video",
    icon: Video,
    description: "Video generation and understanding",
    color: "#f43f5e",
  },
  {
    slug: "code",
    label: "Code",
    shortLabel: "Code",
    icon: Code,
    description: "Code generation and understanding",
    color: "#22d3ee",
  },
  {
    slug: "agentic_browser",
    label: "Browser Agents",
    shortLabel: "Browser Agents",
    icon: Globe,
    description: "AI-powered browser automation and web agents",
    color: "#6366f1",
  },
  {
    slug: "specialized",
    label: "Specialized",
    shortLabel: "Specialized",
    icon: Sparkles,
    description: "Domain-specific models (medical, legal, etc.)",
    color: "#d97706",
  },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c])
) as Record<ModelCategory, CategoryConfig>;
