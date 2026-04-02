export function isE2ETestMode(): boolean {
  return (
    process.env.E2E_TEST_MODE === "true" ||
    process.env.NEXT_PUBLIC_E2E_MSW === "true"
  );
}

