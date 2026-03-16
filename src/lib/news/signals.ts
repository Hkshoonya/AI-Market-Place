export type NewsSignalType =
  | "launch"
  | "benchmark"
  | "pricing"
  | "api"
  | "open_source"
  | "safety"
  | "research"
  | "general";

export type NewsSignalImportance = "high" | "medium" | "low";

export interface NewsSignalSummary {
  signalType: NewsSignalType;
  importance: NewsSignalImportance;
  category: string;
  tags: string[];
  flags: {
    launch: boolean;
    benchmark: boolean;
    pricing: boolean;
    api: boolean;
    openSource: boolean;
    safety: boolean;
    research: boolean;
  };
}

const SIGNAL_PATTERNS: Array<{
  type: NewsSignalType;
  category: string;
  importance: NewsSignalImportance;
  tag: string;
  patterns: RegExp[];
}> = [
  {
    type: "benchmark",
    category: "benchmark",
    importance: "high",
    tag: "benchmark",
    patterns: [
      /\bbenchmark\b/i,
      /\bleaderboard\b/i,
      /\barena\b/i,
      /\bswe-bench\b/i,
      /\blivebench\b/i,
      /\bmmlu\b/i,
      /\bscore\b/i,
      /\bsota\b/i,
    ],
  },
  {
    type: "pricing",
    category: "pricing",
    importance: "high",
    tag: "pricing",
    patterns: [
      /\bpricing\b/i,
      /\bprice\b/i,
      /\bcost\b/i,
      /\bper million\b/i,
      /\bcheaper\b/i,
      /\bdiscount\b/i,
      /\bcredits?\b/i,
    ],
  },
  {
    type: "launch",
    category: "launch",
    importance: "high",
    tag: "launch",
    patterns: [
      /\blaunch(?:ed|ing)?\b/i,
      /\breleas(?:e|ed|ing)\b/i,
      /\bintroducing\b/i,
      /\bnow available\b/i,
      /\bavailable now\b/i,
      /\bshipping\b/i,
      /\broll(?:ing)? out\b/i,
      /\bannounce(?:d|ment)?\b/i,
      /\bnew model\b/i,
      /\bpreview\b/i,
    ],
  },
  {
    type: "api",
    category: "api",
    importance: "medium",
    tag: "api",
    patterns: [
      /\bapi\b/i,
      /\bdeveloper(s)?\b/i,
      /\bsdk\b/i,
      /\bendpoint\b/i,
      /\bfunction calling\b/i,
      /\btool calling\b/i,
      /\bintegration\b/i,
    ],
  },
  {
    type: "open_source",
    category: "open_source",
    importance: "medium",
    tag: "open-source",
    patterns: [
      /\bopen[- ]source\b/i,
      /\bopen[- ]weights?\b/i,
      /\bweights?\b/i,
      /\bcheckpoint\b/i,
      /\bapache 2\.0\b/i,
      /\bmit license\b/i,
    ],
  },
  {
    type: "safety",
    category: "safety",
    importance: "medium",
    tag: "safety",
    patterns: [
      /\bsafety\b/i,
      /\balignment\b/i,
      /\bguardrail\b/i,
      /\bpolicy\b/i,
      /\bsecurity\b/i,
      /\bpreparedness\b/i,
    ],
  },
  {
    type: "research",
    category: "research",
    importance: "low",
    tag: "research",
    patterns: [
      /\bresearch\b/i,
      /\bpaper\b/i,
      /\bpreprint\b/i,
      /\bstudy\b/i,
      /\btechnical report\b/i,
    ],
  },
];

function uniq(items: Iterable<string>) {
  return [...new Set(items)].filter(Boolean);
}

export function classifyNewsSignal(text: string): NewsSignalSummary {
  const normalized = text.trim();
  const matched = SIGNAL_PATTERNS.filter((entry) =>
    entry.patterns.some((pattern) => pattern.test(normalized))
  );

  const highestPriority =
    matched[0] ??
    ({
      type: "general",
      category: "announcement",
      importance: "low",
      tag: "update",
    } satisfies Omit<(typeof SIGNAL_PATTERNS)[number], "patterns">);

  return {
    signalType: highestPriority.type,
    importance: highestPriority.importance,
    category: highestPriority.category,
    tags: uniq([
      ...matched.map((entry) => entry.tag),
      highestPriority.type === "general" ? "update" : "",
    ]),
    flags: {
      launch: matched.some((entry) => entry.type === "launch"),
      benchmark: matched.some((entry) => entry.type === "benchmark"),
      pricing: matched.some((entry) => entry.type === "pricing"),
      api: matched.some((entry) => entry.type === "api"),
      openSource: matched.some((entry) => entry.type === "open_source"),
      safety: matched.some((entry) => entry.type === "safety"),
      research: matched.some((entry) => entry.type === "research"),
    },
  };
}
