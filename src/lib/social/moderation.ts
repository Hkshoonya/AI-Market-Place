import type {
  SocialPostReportAutomationState,
  SocialPostReportReason,
  SocialPostReportStatus,
} from "@/types/database";

export type SocialModerationDecision = "auto_action" | "needs_admin_review" | "no_action";
export type SocialModerationAction = "remove_root" | "hide_reply" | null;

export interface SocialModerationTriageInput {
  reason: SocialPostReportReason;
  content: string;
  details?: string | null;
  isRootPost: boolean;
}

export interface SocialModerationTriageResult {
  label: SocialPostReportReason;
  confidence: number;
  decision: SocialModerationDecision;
  action: SocialModerationAction;
  reportStatus: SocialPostReportStatus;
  automationState: SocialPostReportAutomationState;
}

const SPAM_PATTERNS = [
  "guaranteed profit",
  "100x",
  "airdrop",
  "scam link",
  "double your",
  "telegram",
  "whatsapp",
  "dm for",
  "pump signal",
];

const MALWARE_PATTERNS = [
  "password stealer",
  "token drainer",
  "credential harvester",
  "drainer builder",
  "phishing kit",
  "keylogger",
  "infostealer",
  "malware",
];

const ILLEGAL_GOODS_PATTERNS = [
  "stolen cards",
  "counterfeit id",
  "carding",
  "cracked accounts",
  "exploit kit",
  "ransomware",
];

const ABUSE_REVIEW_PATTERNS = [
  "trash",
  "disappear",
  "worthless",
  "idiot",
  "kill yourself",
];

function normalizeText(input: string | null | undefined) {
  return (input ?? "").toLowerCase();
}

function countMatches(text: string, patterns: string[]) {
  return patterns.reduce((count, pattern) => count + (text.includes(pattern) ? 1 : 0), 0);
}

function actionForPost(isRootPost: boolean): SocialModerationAction {
  return isRootPost ? "remove_root" : "hide_reply";
}

export function triageSocialPostReport(
  input: SocialModerationTriageInput
): SocialModerationTriageResult {
  const combined = `${normalizeText(input.content)} ${normalizeText(input.details)}`.trim();

  const spamMatches = countMatches(combined, SPAM_PATTERNS);
  if (input.reason === "spam" && spamMatches >= 2) {
    return {
      label: "spam",
      confidence: 0.96,
      decision: "auto_action",
      action: actionForPost(input.isRootPost),
      reportStatus: "actioned",
      automationState: "auto_actioned",
    };
  }

  const malwareMatches = countMatches(combined, MALWARE_PATTERNS);
  if (input.reason === "malware" && malwareMatches >= 1) {
    return {
      label: "malware",
      confidence: 0.99,
      decision: "auto_action",
      action: actionForPost(input.isRootPost),
      reportStatus: "actioned",
      automationState: "auto_actioned",
    };
  }

  const illegalGoodsMatches = countMatches(combined, ILLEGAL_GOODS_PATTERNS);
  if (input.reason === "illegal_goods" && illegalGoodsMatches >= 1) {
    return {
      label: "illegal_goods",
      confidence: 0.98,
      decision: "auto_action",
      action: actionForPost(input.isRootPost),
      reportStatus: "actioned",
      automationState: "auto_actioned",
    };
  }

  const abuseMatches = countMatches(combined, ABUSE_REVIEW_PATTERNS);
  if (input.reason === "abuse" && abuseMatches >= 1) {
    return {
      label: "abuse",
      confidence: 0.72,
      decision: "needs_admin_review",
      action: null,
      reportStatus: "triaged",
      automationState: "needs_admin_review",
    };
  }

  return {
    label: input.reason,
    confidence: 0.2,
    decision: "no_action",
    action: null,
    reportStatus: "open",
    automationState: "pending",
  };
}
