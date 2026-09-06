import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendContactSubmissionEmail } from "./contact-email";

const ORIGINAL_ENV = process.env;

const contactInput = {
  name: "Harshit",
  email: "harshit@example.com",
  category: "general",
  subject: "Need help",
  message: "Hello <script>alert('xss')</script>",
};

describe("sendContactSubmissionEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTACT_EMAIL_FROM;
    delete process.env.CONTACT_EMAIL_TO;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("skips delivery when Resend is not configured", async () => {
    await expect(sendContactSubmissionEmail(contactInput)).resolves.toEqual({
      status: "skipped",
      reason: "not_configured",
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends a sanitized contact email through Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.CONTACT_EMAIL_FROM = "AI Market Cap <hello@aimarketcap.tech>";
    process.env.CONTACT_EMAIL_TO = "support@aimarketcap.tech";
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email-1" }),
    } as Response);

    await expect(sendContactSubmissionEmail(contactInput)).resolves.toEqual({
      status: "sent",
      id: "email-1",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
          "User-Agent": "ai-market-cap/1.0",
        },
      })
    );
    const payload = JSON.parse(
      String(vi.mocked(global.fetch).mock.calls[0]?.[1]?.body)
    ) as Record<string, unknown>;

    expect(payload).toMatchObject({
      from: "AI Market Cap <hello@aimarketcap.tech>",
      to: ["support@aimarketcap.tech"],
      reply_to: "harshit@example.com",
      subject: "[AI Market Cap] Need help",
    });
    expect(payload.html).toContain("&lt;script&gt;");
    expect(payload.html).not.toContain("<script>");
    expect(payload.text).toContain(contactInput.message);
  });

  it("returns a failed result when the provider rejects delivery", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "Domain not verified" }),
    } as Response);

    await expect(sendContactSubmissionEmail(contactInput)).resolves.toEqual({
      status: "failed",
      error: "Email provider returned 422",
    });
  });

  it("contains network failures instead of failing an already-saved contact submission", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.mocked(global.fetch).mockRejectedValue(new Error("secret credential or recipient details"));
    await expect(sendContactSubmissionEmail(contactInput)).resolves.toEqual({
      status: "failed",
      error: "Email delivery request failed",
    });
  });

  it("bounds delivery requests and reports timeouts without sensitive error text", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.mocked(global.fetch).mockRejectedValue(new DOMException("private details", "TimeoutError"));
    await expect(sendContactSubmissionEmail(contactInput)).resolves.toEqual({
      status: "failed",
      error: "Email delivery request timed out",
    });
    expect(timeout).toHaveBeenCalledWith(10000);
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }));
  });

  it.each([null, {}, { id: "" }, { id: 42 }])("does not report success without an email ID: %j", async (body) => {
    process.env.RESEND_API_KEY = "re_test";
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => body } as Response);
    await expect(sendContactSubmissionEmail(contactInput)).resolves.toEqual({
      status: "failed",
      error: "Email provider returned an invalid response",
    });
  });
});
