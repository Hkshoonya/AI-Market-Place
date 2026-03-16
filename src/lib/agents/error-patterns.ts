export function normalizeAgentErrorPatternMessage(message: string): string {
  return message
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<UUID>"
    )
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, "<TIMESTAMP>")
    .replace(/\d+/g, "<N>");
}

export function matchesAgentErrorPattern(message: string, pattern: string): boolean {
  const normalizedMessage = normalizeAgentErrorPatternMessage(message).trim();
  const normalizedPattern = normalizeAgentErrorPatternMessage(pattern).trim();

  if (!normalizedMessage || !normalizedPattern) {
    return false;
  }

  return (
    normalizedMessage === normalizedPattern ||
    normalizedMessage.startsWith(normalizedPattern) ||
    normalizedPattern.startsWith(normalizedMessage)
  );
}
