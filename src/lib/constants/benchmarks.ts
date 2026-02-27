export interface BenchmarkConfig {
  slug: string;
  name: string;
  category: "knowledge" | "coding" | "math" | "reasoning" | "general" | "safety";
  scoreType: "percentage" | "elo" | "pass_rate" | "absolute";
  maxScore: number;
  description: string;
  source: string;
}

export const BENCHMARKS: BenchmarkConfig[] = [
  {
    slug: "mmlu",
    name: "MMLU",
    category: "knowledge",
    scoreType: "percentage",
    maxScore: 100,
    description: "Massive Multitask Language Understanding — 57 subjects",
    source: "open_llm_leaderboard",
  },
  {
    slug: "humaneval",
    name: "HumanEval",
    category: "coding",
    scoreType: "pass_rate",
    maxScore: 100,
    description: "Programming problems — pass@1 rate",
    source: "open_llm_leaderboard",
  },
  {
    slug: "math",
    name: "MATH",
    category: "math",
    scoreType: "percentage",
    maxScore: 100,
    description: "Mathematical problem-solving benchmark",
    source: "open_llm_leaderboard",
  },
  {
    slug: "gpqa",
    name: "GPQA",
    category: "reasoning",
    scoreType: "percentage",
    maxScore: 100,
    description: "Graduate-level advanced reasoning",
    source: "open_llm_leaderboard",
  },
  {
    slug: "bbh",
    name: "BBH",
    category: "reasoning",
    scoreType: "percentage",
    maxScore: 100,
    description: "Big Bench Hard — 23 challenging reasoning tasks",
    source: "open_llm_leaderboard",
  },
  {
    slug: "hellaswag",
    name: "HellaSwag",
    category: "reasoning",
    scoreType: "percentage",
    maxScore: 100,
    description: "Commonsense reasoning benchmark",
    source: "open_llm_leaderboard",
  },
  {
    slug: "arc",
    name: "ARC",
    category: "reasoning",
    scoreType: "percentage",
    maxScore: 100,
    description: "AI2 Reasoning Challenge",
    source: "open_llm_leaderboard",
  },
  {
    slug: "truthfulqa",
    name: "TruthfulQA",
    category: "safety",
    scoreType: "percentage",
    maxScore: 100,
    description: "Factual accuracy and truthfulness",
    source: "open_llm_leaderboard",
  },
  {
    slug: "ifeval",
    name: "IFEval",
    category: "general",
    scoreType: "percentage",
    maxScore: 100,
    description: "Instruction following evaluation",
    source: "open_llm_leaderboard",
  },
  {
    slug: "swe_bench",
    name: "SWE-Bench",
    category: "coding",
    scoreType: "percentage",
    maxScore: 100,
    description: "Software engineering challenges",
    source: "independent",
  },
  {
    slug: "chatbot_arena_elo",
    name: "Chatbot Arena Elo",
    category: "general",
    scoreType: "elo",
    maxScore: 2000,
    description: "Crowdsourced human preference Elo rating",
    source: "lmsys",
  },
];
