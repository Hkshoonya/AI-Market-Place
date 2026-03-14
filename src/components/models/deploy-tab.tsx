"use client";

import { useState } from "react";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import { ExternalLink, Copy, Check, Zap, DollarSign, Server, Monitor } from "lucide-react";

interface Platform {
  id: string;
  slug: string;
  name: string;
  type: string;
  base_url: string;
  has_affiliate: boolean;
  affiliate_url: string | null;
  affiliate_tag: string | null;
}

interface Deployment {
  platform: Platform;
  reason: string;
  confidence: "direct" | "pricing_inferred" | "provider_family" | "open_weight_runtime";
  deployment?: {
    id: string;
    deploy_url: string | null;
    pricing_model: string | null;
    price_per_unit: number | null;
    unit_description: string | null;
    free_tier: string | null;
    one_click: boolean;
  };
}

interface DeployTabProps {
  modelSlug: string;
  modelName: string;
  isOpenWeights: boolean;
}

const UTM_PARAMS = "?ref=aimarketcap&utm_source=aimarketcap&utm_medium=deploy_tab";

/** Returns the best URL for a platform: affiliate_url if set, otherwise base_url + UTM */
function getPlatformUrl(platform: Platform, deployUrl?: string | null): string {
  if (platform.affiliate_url) return platform.affiliate_url;
  return `${deployUrl || platform.base_url}${UTM_PARAMS}`;
}

/** Returns proper rel attribute: sponsored for affiliate links */
function getLinkRel(platform: Platform): string {
  return platform.affiliate_url ? "noopener sponsored" : "noopener noreferrer";
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  api: <Zap className="h-4 w-4" />,
  hosting: <Server className="h-4 w-4" />,
  subscription: <DollarSign className="h-4 w-4" />,
  "self-hosted": <Server className="h-4 w-4" />,
  local: <Monitor className="h-4 w-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  api: "API Providers",
  hosting: "Cloud Hosting",
  subscription: "Subscriptions",
  "self-hosted": "Self-Host GPU",
  local: "Local/Edge",
};

const CONFIDENCE_LABELS: Record<Deployment["confidence"], string> = {
  direct: "Verified",
  pricing_inferred: "Pricing Observed",
  provider_family: "Related Access",
  open_weight_runtime: "Runtime Compatible",
};

// Ollama/llama.cpp commands for open-weight models
function getLocalCommand(platformSlug: string, modelName: string): string | null {
  const sanitized = modelName.toLowerCase().replace(/\s+/g, "-");
  if (platformSlug === "ollama") return `ollama pull ${sanitized}`;
  if (platformSlug === "llamacpp") return `# Download GGUF from HuggingFace and run:\n./llama-server -m ${sanitized}.gguf --port 8080`;
  if (platformSlug === "lm-studio") return `# Search "${modelName}" in LM Studio model browser`;
  return null;
}

export function DeployTab({ modelSlug, modelName, isOpenWeights }: DeployTabProps) {
  const { data, error, isLoading } = useSWR<{ deployments: Deployment[]; relatedPlatforms: Deployment[] }>(
    `/api/models/${modelSlug}/deployments`,
    { ...SWR_TIERS.SLOW }
  );
  const deployments = data?.deployments ?? [];
  const relatedPlatforms = data?.relatedPlatforms ?? [];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-card/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 p-4">{error?.message || "Failed to load deployment options"}</p>;
  }

  const grouped = new Map<string, Deployment[]>();
  for (const item of relatedPlatforms) {
    if (!grouped.has(item.platform.type)) grouped.set(item.platform.type, []);
    grouped.get(item.platform.type)!.push(item);
  }

  return (
    <div className="space-y-6">
      {/* Pricing Comparison Table */}
      {deployments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#00d4aa]" />
            Pricing Comparison
          </h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-card/50">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Platform</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Price</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-medium">Free Tier</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d, i) => {
                  const platform = d.platform;
                  const deployment = d.deployment;
                  return (
                    <tr key={platform.id} className={cn("border-b border-border/20", i === 0 && "bg-[#00d4aa]/5")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {TYPE_ICONS[platform.type]}
                          <span className="font-medium text-white">{platform.name}</span>
                          {i === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4aa]/20 text-[#00d4aa] font-semibold">
                              BEST VALUE
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                            {CONFIDENCE_LABELS[d.confidence]}
                          </span>
                          {platform.affiliate_url && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                              Partner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{platform.type.replace("-", " ")}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {deployment?.pricing_model === "free" ? (
                          <span className="text-green-400">Free</span>
                        ) : deployment?.price_per_unit ? (
                          `$${deployment.price_per_unit}/${deployment.unit_description || "unit"}`
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {deployment?.free_tier ? (
                          <span className="text-green-400 text-xs">{deployment.free_tier}</span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={getPlatformUrl(platform, deployment?.deploy_url)}
                          target="_blank"
                          rel={getLinkRel(platform)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
                        >
                          Deploy <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {relatedPlatforms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Related options below are ecosystem or self-hosting paths that fit this model family.
          They are not stored as verified model-specific deployments unless explicitly marked above.
        </p>
      )}

      {/* Related platform categories */}
      {Array.from(grouped.entries()).map(([type, typePlatforms]) => (
        <div key={type}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            {TYPE_ICONS[type]}
            {TYPE_LABELS[type] || type} <span className="text-xs text-muted-foreground font-normal">Related options</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {typePlatforms.map((item) => {
              const platform = item.platform;
              const localCmd = isOpenWeights ? getLocalCommand(platform.slug, modelName) : null;

              return (
                <div
                  key={platform.id}
                  className="rounded-lg border border-border/30 p-3 bg-card/20 hover:border-border/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-white">{platform.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        {CONFIDENCE_LABELS[item.confidence]}
                      </span>
                      {platform.has_affiliate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                          Partner
                        </span>
                      )}
                    </div>
                  </div>
                  {item.deployment?.price_per_unit && (
                    <p className="text-xs text-muted-foreground mb-2 font-mono">
                      ${item.deployment.price_per_unit}/{item.deployment.unit_description || "unit"}
                    </p>
                  )}
                  <p className="mb-2 text-xs text-muted-foreground leading-relaxed">
                    {item.reason}
                  </p>
                  {localCmd && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-black/50 rounded px-2 py-1 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground font-mono">
                          {localCmd.split("\n")[0]}
                        </code>
                        <button
                          onClick={() => copyToClipboard(localCmd, platform.id)}
                          className="p-1 text-muted-foreground hover:text-white"
                        >
                          {copiedId === platform.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <a
                    href={getPlatformUrl(platform, item.deployment?.deploy_url)}
                    target="_blank"
                    rel={getLinkRel(platform)}
                    className="inline-flex items-center gap-1 text-xs text-[#00d4aa] hover:text-[#00d4aa]/80 transition-colors"
                  >
                    {item.deployment ? "Deploy" : "Explore"} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Self-Hosting Guide for Open-Weight Models */}
      {isOpenWeights && (
        <div className="rounded-lg border border-border/50 p-4 bg-card/20">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-[#00d4aa]" />
            Self-Hosting Guide
          </h3>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-white mb-1">Docker + vLLM</p>
              <div className="flex items-center gap-1">
                <code className="bg-black/50 rounded px-2 py-1 flex-1 overflow-auto font-mono">
                  docker run --gpus all -p 8000:8000 vllm/vllm-openai --model {modelName.toLowerCase().replace(/\s+/g, "-")}
                </code>
                <button
                  onClick={() => copyToClipboard(`docker run --gpus all -p 8000:8000 vllm/vllm-openai --model ${modelName.toLowerCase().replace(/\s+/g, "-")}`, "vllm")}
                  className="p-1 text-muted-foreground hover:text-white shrink-0"
                >
                  {copiedId === "vllm" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Ollama</p>
              <div className="flex items-center gap-1">
                <code className="bg-black/50 rounded px-2 py-1 flex-1 font-mono">
                  ollama pull {modelName.toLowerCase().replace(/\s+/g, "-")}
                </code>
                <button
                  onClick={() => copyToClipboard(`ollama pull ${modelName.toLowerCase().replace(/\s+/g, "-")}`, "ollama-cmd")}
                  className="p-1 text-muted-foreground hover:text-white shrink-0"
                >
                  {copiedId === "ollama-cmd" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
