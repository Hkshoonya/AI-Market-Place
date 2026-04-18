export interface UpgradeHighlightSource {
  description?: string | null;
  short_description?: string | null;
}

function splitIntoSentences(summary: string) {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function getModelUpgradeHighlight(model: UpgradeHighlightSource) {
  const summary = model.short_description ?? model.description;
  if (!summary) return null;

  const sentences = splitIntoSentences(summary);
  const exactUpgradeSentence = sentences.find((sentence) =>
    /(improves on|better than|stronger than|recommended replacement|superseded by|previous flagship|previous full)/i.test(
      sentence
    )
  );
  if (exactUpgradeSentence) {
    return exactUpgradeSentence;
  }

  const broadLifecycleSentence = sentences.find((sentence) =>
    /\b(latest|flagship|most capable|state-of-the-art|stronger)\b/i.test(sentence)
  );
  if (broadLifecycleSentence) {
    return broadLifecycleSentence;
  }

  return null;
}
