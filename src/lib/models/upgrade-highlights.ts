export interface UpgradeHighlightSource {
  description?: string | null;
  short_description?: string | null;
}

export function getModelUpgradeHighlight(model: UpgradeHighlightSource) {
  const summary = model.short_description ?? model.description;
  if (!summary) return null;

  const normalized = summary.toLowerCase();
  if (
    /improves on/.test(normalized) ||
    /\blatest\b/.test(normalized) ||
    /\bstronger\b/.test(normalized) ||
    /recommended replacement/.test(normalized) ||
    /previous flagship/.test(normalized) ||
    /previous full/.test(normalized)
  ) {
    return summary;
  }

  return null;
}
