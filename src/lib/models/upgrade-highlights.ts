export interface UpgradeHighlightSource {
  description?: string | null;
  short_description?: string | null;
}

export type UpgradeHighlightKind = "upgrade" | "lifecycle";

function splitIntoSentences(summary: string) {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function matchUpgradeHighlight(model: UpgradeHighlightSource): {
  kind: UpgradeHighlightKind;
  text: string;
} | null {
  const summary = model.short_description ?? model.description;
  if (!summary) return null;

  const sentences = splitIntoSentences(summary);
  const exactUpgradeSentence = sentences.find((sentence) =>
    /(improves on|better than|stronger than|recommended replacement|superseded by|previous flagship|previous full)/i.test(
      sentence
    )
  );
  if (exactUpgradeSentence) {
    return {
      kind: /(previous flagship|previous full|recommended replacement|superseded by)/i.test(
        exactUpgradeSentence
      )
        ? "lifecycle"
        : "upgrade",
      text: exactUpgradeSentence,
    };
  }

  const broadLifecycleSentence = sentences.find((sentence) =>
    /\b(latest|flagship|most capable|state-of-the-art|stronger)\b/i.test(sentence)
  );
  if (broadLifecycleSentence) {
    return {
      kind: "upgrade",
      text: broadLifecycleSentence,
    };
  }

  return null;
}

export function getModelUpgradeHighlight(model: UpgradeHighlightSource) {
  return matchUpgradeHighlight(model)?.text ?? null;
}

export function getModelUpgradeHighlightKind(
  model: UpgradeHighlightSource
): UpgradeHighlightKind | null {
  return matchUpgradeHighlight(model)?.kind ?? null;
}
