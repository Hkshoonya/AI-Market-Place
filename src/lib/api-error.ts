import { systemLog } from "@/lib/logging";

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function handleApiError(error: unknown, source: string): Response {
  if (error instanceof ApiError) {
    void systemLog.warn(source, error.message, { statusCode: error.statusCode });
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  void systemLog.error(source, "Unexpected error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
