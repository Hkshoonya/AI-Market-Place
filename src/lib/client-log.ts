export function clientWarn(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

export function clientError(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.error(...args);
  }
}
