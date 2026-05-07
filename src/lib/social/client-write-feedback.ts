export type SocialWriteAction = "thread" | "reply";

export type SocialWriteFailureCategory =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "server"
  | "network"
  | "unknown";

export interface SocialWriteFailure {
  status: number;
  category: SocialWriteFailureCategory;
  detail: string | null;
  message: string;
}

function readErrorDetail(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim().length > 0
  ) {
    return body.error.trim();
  }

  return null;
}

function actionLabel(action: SocialWriteAction) {
  return action === "thread" ? "post in Commons" : "reply in Commons";
}

export function describeSocialWriteFailure(input: {
  action: SocialWriteAction;
  status: number;
  detail?: string | null;
}): SocialWriteFailure {
  const detail = input.detail?.trim() || null;

  switch (input.status) {
    case 401:
      return {
        status: input.status,
        category: "unauthorized",
        detail,
        message: `Your session is missing or expired. Sign in again to ${actionLabel(input.action)}.`,
      };
    case 403:
      return {
        status: input.status,
        category: "forbidden",
        detail,
        message:
          "This browser request was blocked before it reached Commons. Refresh the page and retry from this tab.",
      };
    case 400:
      return {
        status: input.status,
        category: "validation",
        detail,
        message:
          detail ??
          (input.action === "thread"
            ? "The thread fields were invalid. Check the title and content, then try again."
            : "The reply was invalid. Check the content, then try again."),
      };
    default:
      if (input.status >= 500) {
        return {
          status: input.status,
          category: "server",
          detail,
          message:
            detail ??
            (input.action === "thread"
              ? "AI Market Cap could not publish this thread right now. Try again shortly."
              : "AI Market Cap could not publish this reply right now. Try again shortly."),
        };
      }

      return {
        status: input.status,
        category: "unknown",
        detail,
        message:
          detail ??
          (input.action === "thread"
            ? "Failed to post thread."
            : "Failed to post reply."),
      };
  }
}

export async function parseSocialWriteFailure(
  response: Response,
  action: SocialWriteAction
): Promise<SocialWriteFailure> {
  const body = await response.json().catch(() => null);
  const detail = readErrorDetail(body);
  return describeSocialWriteFailure({
    action,
    status: response.status,
    detail,
  });
}
