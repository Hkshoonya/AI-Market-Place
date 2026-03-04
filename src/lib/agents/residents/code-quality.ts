/**
 * Code Quality Monitor — Resident Agent
 *
 * Monitors runtime errors, analyzes patterns using Claude,
 * and creates GitHub issues with suggested fixes.
 *
 * Schedule: Daily at 9 AM
 * Capabilities: error_analysis, github_issues, code_review, pattern_detection
 */

import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";

interface ErrorPattern {
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleMetadata: Record<string, unknown> | null;
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
      // Step 1: Fetch error logs from last 24 hours
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
        await log.info("No errors found — all clear!");
        return { success: true, output, errors };
      }

      // Step 2: Group errors by pattern (normalize messages)
      const patternMap = new Map<string, ErrorPattern>();
      for (const entry of logs) {
        // Normalize: remove UUIDs, timestamps, numbers for grouping
        const normalized = entry.message
          .replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            "<UUID>"
          )
          .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, "<TIMESTAMP>")
          .replace(/\d+/g, "<N>");

        const existing = patternMap.get(normalized);
        if (existing) {
          existing.count++;
          if (entry.created_at < existing.firstSeen)
            existing.firstSeen = entry.created_at;
          if (entry.created_at > existing.lastSeen)
            existing.lastSeen = entry.created_at;
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

      // Sort by frequency
      const patterns = Array.from(patternMap.values()).sort(
        (a, b) => b.count - a.count
      );

      output.errorPatterns = patterns.slice(0, 10);
      await log.info(`Identified ${patterns.length} unique error patterns`);

      // Step 3: Analyze top errors with Claude (if API key available)
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const analysisResults: Record<string, unknown>[] = [];

      if (anthropicKey && patterns.length > 0) {
        try {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const client = new Anthropic({ apiKey: anthropicKey });

          const maxAnalyze = Math.min(
            patterns.length,
            (ctx.agent.config.max_issues_per_run as number) ?? 5
          );

          for (const pattern of patterns.slice(0, maxAnalyze)) {
            try {
              const response = await client.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                messages: [
                  {
                    role: "user",
                    content: `You are analyzing runtime errors from a Next.js 16 + Supabase web application called "AI Market Cap".

Error message (occurred ${pattern.count} times in 24h):
"${pattern.message}"

${pattern.sampleMetadata ? `Metadata: ${JSON.stringify(pattern.sampleMetadata)}` : ""}

Provide:
1. Root cause analysis (1-2 sentences)
2. Severity: critical / high / medium / low
3. Suggested fix (brief code-level suggestion)
4. A concise GitHub issue title

Respond in JSON format:
{"rootCause": "...", "severity": "...", "suggestedFix": "...", "issueTitle": "..."}`,
                  },
                ],
              });

              const text =
                response.content[0].type === "text"
                  ? response.content[0].text
                  : "";
              try {
                const analysis = JSON.parse(text);
                analysisResults.push({
                  pattern: pattern.message.substring(0, 200),
                  count: pattern.count,
                  ...analysis,
                });
                await log.info(
                  `Analyzed: ${pattern.message.substring(0, 100)}`,
                  analysis
                );
              } catch {
                analysisResults.push({
                  pattern: pattern.message.substring(0, 200),
                  count: pattern.count,
                  rawAnalysis: text,
                });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await log.warn(`Claude analysis failed for pattern: ${msg}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await log.warn(`Anthropic SDK import/init failed: ${msg}`);
        }
      } else if (!anthropicKey) {
        await log.info("ANTHROPIC_API_KEY not set — skipping Claude analysis");
      }
      output.analysisResults = analysisResults;

      // Step 4: Create GitHub issues (if token available)
      const githubToken = process.env.GITHUB_TOKEN;
      const issuesCreated: Record<string, unknown>[] = [];

      if (githubToken && analysisResults.length > 0) {
        try {
          const { Octokit } = await import("octokit");
          const octokit = new Octokit({ auth: githubToken });

          // Get repo info from config or defaults
          const repoOwner =
            (ctx.agent.config.github_owner as string) ?? "Hkshoonya";
          const repoName =
            (ctx.agent.config.github_repo as string) ?? "AI-Market-Place";

          // Fetch existing open issues to avoid duplicates
          const { data: existingIssues } = await octokit.rest.issues.listForRepo(
            {
              owner: repoOwner,
              repo: repoName,
              state: "open",
              labels: "agent:code-quality",
              per_page: 100,
            }
          );

          const existingTitles = new Set(
            existingIssues.map((i: { title: string }) => i.title.toLowerCase())
          );

          for (const result of analysisResults) {
            const title =
              (result.issueTitle as string) ??
              `Error: ${(result.pattern as string).substring(0, 80)}`;

            // Skip if similar issue already exists
            if (existingTitles.has(title.toLowerCase())) {
              await log.info(`Skipping duplicate issue: ${title}`);
              continue;
            }

            try {
              const body = [
                `## Auto-detected by Code Quality Agent`,
                ``,
                `**Occurrences:** ${result.count} times in the last 24 hours`,
                `**Severity:** ${result.severity ?? "unknown"}`,
                ``,
                `### Error Pattern`,
                `\`\`\``,
                result.pattern,
                `\`\`\``,
                ``,
                `### Root Cause`,
                result.rootCause ?? "Analysis unavailable",
                ``,
                `### Suggested Fix`,
                result.suggestedFix ?? "Manual investigation needed",
                ``,
                `---`,
                `*This issue was automatically created by the Code Quality Monitor agent.*`,
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

              await log.info(
                `Created GitHub issue #${issue.number}: ${title}`
              );
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
        await log.info(
          "GITHUB_TOKEN not set — skipping GitHub issue creation"
        );
      }
      output.issuesCreated = issuesCreated;

      // Step 5: Summary
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
