/**
 * Code Quality Monitor - Resident Agent
 *
 * Monitors runtime errors, analyzes patterns using the shared agent model router,
 * and creates GitHub issues with suggested fixes.
 *
 * Schedule: Daily at 9 AM
 * Capabilities: error_analysis, github_issues, code_review, pattern_detection
 */

import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { callAgentModel, listConfiguredAgentProviders } from "../provider-router";
import { recordAgentIssue } from "../ledger";
import { makeSlug } from "../../data-sources/utils";
import { normalizeAgentErrorPatternMessage } from "../error-patterns";

export interface ErrorPattern {
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleMetadata: Record<string, unknown> | null;
}

export async function analyzeErrorPatternWithModel(
  pattern: ErrorPattern
): Promise<Record<string, unknown>> {
  const response = await callAgentModel({
    system:
      'You analyze runtime errors from a Next.js 16 + Supabase application and respond with strict JSON containing "rootCause", "severity", "suggestedFix", and "issueTitle".',
    prompt: `Error message (occurred ${pattern.count} times in 24h):
"${pattern.message}"

${pattern.sampleMetadata ? `Metadata: ${JSON.stringify(pattern.sampleMetadata)}` : ""}

Provide:
1. Root cause analysis (1-2 sentences)
2. Severity: critical / high / medium / low
3. Suggested fix (brief code-level suggestion)
4. A concise GitHub issue title

Respond in JSON format:
{"rootCause": "...", "severity": "...", "suggestedFix": "...", "issueTitle": "..."}`,
    responseFormat: "json",
    maxTokens: 1024,
  });

  try {
    return {
      ...JSON.parse(response.content),
      llmProvider: response.provider,
      llmModel: response.model,
    };
  } catch {
    return {
      rawAnalysis: response.content,
      llmProvider: response.provider,
      llmModel: response.model,
    };
  }
}

const codeQuality: ResidentAgent = {
  slug: "code-quality",
  name: "Code Quality Monitor",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const { supabase, log } = ctx;
    const sb = supabase;
    const errors: string[] = [];
    const output: Record<string, unknown> = {
      errorPatterns: [],
      analysisResults: [],
      issuesCreated: [],
      summary: {},
    };

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: errorLogs, error: fetchErr } = await sb
        .from("agent_logs")
        .select("*")
        .eq("level", "error")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (fetchErr) {
        errors.push(`Failed to fetch error logs: ${fetchErr.message}`);
        return { success: false, output, errors };
      }

      const logs = (errorLogs ?? []) as {
        message: string;
        created_at: string;
        metadata: Record<string, unknown> | null;
      }[];
      await log.info(`Found ${logs.length} error logs in last 24 hours`);

      if (logs.length === 0) {
        output.summary = {
          totalErrors: 0,
          uniquePatterns: 0,
          issuesCreated: 0,
        };
        await log.info("No errors found - all clear!");
        return { success: true, output, errors };
      }

      const patternMap = new Map<string, ErrorPattern>();
      for (const entry of logs) {
        const normalized = normalizeAgentErrorPatternMessage(entry.message);

        const existing = patternMap.get(normalized);
        if (existing) {
          existing.count++;
          if (entry.created_at < existing.firstSeen) existing.firstSeen = entry.created_at;
          if (entry.created_at > existing.lastSeen) existing.lastSeen = entry.created_at;
        } else {
          patternMap.set(normalized, {
            message: entry.message,
            count: 1,
            firstSeen: entry.created_at,
            lastSeen: entry.created_at,
            sampleMetadata: entry.metadata,
          });
        }
      }

      const patterns = Array.from(patternMap.values()).sort((a, b) => b.count - a.count);

      output.errorPatterns = patterns.slice(0, 10);
      await log.info(`Identified ${patterns.length} unique error patterns`);

      const analysisResults: Record<string, unknown>[] = [];

      if (listConfiguredAgentProviders().length > 0 && patterns.length > 0) {
        const maxAnalyze = Math.min(
          patterns.length,
          (ctx.agent.config.max_issues_per_run as number) ?? 5
        );

        for (const pattern of patterns.slice(0, maxAnalyze)) {
          try {
            const analysis = await analyzeErrorPatternWithModel(pattern);
            analysisResults.push({
              pattern: pattern.message.substring(0, 200),
              count: pattern.count,
              ...analysis,
            });
            await log.info(`Analyzed: ${pattern.message.substring(0, 100)}`, analysis);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await log.warn(`Model analysis failed for pattern: ${msg}`);
          }
        }
      } else if (listConfiguredAgentProviders().length === 0) {
        await log.info("No LLM provider configured - skipping model analysis");
      }
      output.analysisResults = analysisResults;

      for (const result of analysisResults) {
        const issueTitle =
          (result.issueTitle as string | undefined) ??
          `Runtime error pattern: ${String(result.pattern ?? "unknown").slice(0, 80)}`;
        const severity =
          result.severity === "critical" ||
          result.severity === "high" ||
          result.severity === "medium" ||
          result.severity === "low"
            ? result.severity
            : "medium";

        await recordAgentIssue(sb, {
          slug: makeSlug(`code-quality-${issueTitle}`),
          title: issueTitle,
          issueType: "runtime_error_pattern",
          source: null,
          severity,
          confidence: 0.75,
          detectedBy: "code-quality",
          playbook: null,
          evidence: {
            pattern: result.pattern,
            count: result.count,
            rootCause: result.rootCause ?? null,
            suggestedFix: result.suggestedFix ?? null,
            llmProvider: result.llmProvider ?? null,
            llmModel: result.llmModel ?? null,
          },
        }).catch(async (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          await log.warn(`Failed to record code quality issue: ${msg}`);
        });
      }

      const githubToken = process.env.GITHUB_TOKEN;
      const issuesCreated: Record<string, unknown>[] = [];

      if (githubToken && analysisResults.length > 0) {
        try {
          const { Octokit } = await import("octokit");
          const octokit = new Octokit({ auth: githubToken });

          const repoOwner = (ctx.agent.config.github_owner as string) ?? "Hkshoonya";
          const repoName = (ctx.agent.config.github_repo as string) ?? "AI-Market-Place";

          const { data: existingIssues } = await octokit.rest.issues.listForRepo({
            owner: repoOwner,
            repo: repoName,
            state: "open",
            labels: "agent:code-quality",
            per_page: 100,
          });

          const existingTitles = new Set(
            existingIssues.map((issue: { title: string }) => issue.title.toLowerCase())
          );

          for (const result of analysisResults) {
            const title =
              (result.issueTitle as string) ??
              `Error: ${(result.pattern as string).substring(0, 80)}`;

            if (existingTitles.has(title.toLowerCase())) {
              await log.info(`Skipping duplicate issue: ${title}`);
              continue;
            }

            try {
              const body = [
                "## Auto-detected by Code Quality Agent",
                "",
                `**Occurrences:** ${result.count} times in the last 24 hours`,
                `**Severity:** ${result.severity ?? "unknown"}`,
                "",
                "### Error Pattern",
                "```",
                String(result.pattern ?? ""),
                "```",
                "",
                "### Root Cause",
                String(result.rootCause ?? "Analysis unavailable"),
                "",
                "### Suggested Fix",
                String(result.suggestedFix ?? "Manual investigation needed"),
                "",
                "---",
                "*This issue was automatically created by the Code Quality Monitor agent.*",
              ].join("\n");

              const { data: issue } = await octokit.rest.issues.create({
                owner: repoOwner,
                repo: repoName,
                title,
                body,
                labels: [
                  "agent:code-quality",
                  `severity:${result.severity ?? "unknown"}`,
                ],
              });

              issuesCreated.push({
                title,
                number: issue.number,
                url: issue.html_url,
              });

              await log.info(`Created GitHub issue #${issue.number}: ${title}`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await log.warn(`Failed to create issue "${title}": ${msg}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await log.warn(`GitHub integration failed: ${msg}`);
          errors.push(`GitHub: ${msg}`);
        }
      } else if (!githubToken) {
        await log.info("GITHUB_TOKEN not set - skipping GitHub issue creation");
      }
      output.issuesCreated = issuesCreated;

      output.summary = {
        totalErrors: logs.length,
        uniquePatterns: patterns.length,
        patternsAnalyzed: analysisResults.length,
        issuesCreated: issuesCreated.length,
      };

      await log.info(
        "Code Quality Monitor run complete",
        output.summary as Record<string, unknown>
      );

      return {
        success: true,
        output,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      await log.error(`Code Quality Monitor crashed: ${msg}`);
      return { success: false, output, errors };
    }
  },
};

registerAgent(codeQuality);
export default codeQuality;
