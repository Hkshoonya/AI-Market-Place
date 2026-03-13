const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function isRuntimeFlagEnabled(
  name: string,
  defaultValue = false
): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }

  return TRUE_VALUES.has(value.trim().toLowerCase());
}
