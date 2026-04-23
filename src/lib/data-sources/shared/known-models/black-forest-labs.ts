import type { KnownModelMeta } from "../build-record";

export const BLACK_FOREST_LABS_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "flux-dev": {
    name: "FLUX.1 [dev]",
    description:
      "Black Forest Labs open-weight FLUX image model for high-quality text-to-image generation and development workflows.",
    category: "image_generation",
    release_date: "2024-08-01",
    architecture: "Rectified flow transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "FLUX.1 [dev] Non-Commercial License",
    hf_model_id: "black-forest-labs/FLUX.1-dev",
    website_url: "https://bfl.ai/blog/24-08-01-bfl",
  },
  "flux-schnell": {
    name: "FLUX.1 [schnell]",
    description:
      "Black Forest Labs FLUX image model optimized for fast local text-to-image generation.",
    category: "image_generation",
    release_date: "2024-08-01",
    architecture: "Rectified flow transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
    hf_model_id: "black-forest-labs/FLUX.1-schnell",
    website_url: "https://bfl.ai/blog/24-08-01-bfl",
  },
  "flux-pro": {
    name: "FLUX.1 [pro]",
    description:
      "Black Forest Labs flagship FLUX image model for top-end prompt following, detail, and image quality.",
    category: "image_generation",
    release_date: "2024-08-01",
    architecture: "Rectified flow transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://bfl.ai/blog/24-08-01-bfl",
  },
  "flux-1-1-pro": {
    name: "FLUX1.1 [pro]",
    description:
      "Black Forest Labs upgraded FLUX image model with faster generation and better image quality than FLUX.1 [pro].",
    category: "image_generation",
    release_date: "2024-10-02",
    architecture: "Rectified flow transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://bfl.ai/blog/24-10-02-flux",
  },
  "flux-2-pro": {
    name: "FLUX.2 [pro]",
    description:
      "Black Forest Labs production FLUX.2 image model for high-quality generation and multi-reference image editing at scale.",
    category: "image_generation",
    architecture: "Rectified flow transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://bfl.ai/flux2",
  },
  "flux-2-max": {
    name: "FLUX.2 [max]",
    description:
      "Black Forest Labs highest-fidelity FLUX.2 image model for maximum quality, grounding, and multi-reference control.",
    category: "image_generation",
    architecture: "Rectified flow transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://bfl.ai/flux2",
  },
};
