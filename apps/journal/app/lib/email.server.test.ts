import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nodemailer before importing
vi.mock("nodemailer", () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
  }),
}));

// Mock logger
vi.mock("./logger.server", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("email.server", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.SMTP_URL;
  });

  it("uses logger in dev mode instead of sending email", async () => {
    process.env.NODE_ENV = "development";
    const { sendEmail } = await import("./email.server");
    const { logger } = await import("./logger.server");

    await sendEmail("test@example.com", "Test Subject", "<p>Hello</p>", "Hello");

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com" }),
      expect.any(String),
    );
  });

  it("does not call SMTP in dev mode", async () => {
    process.env.NODE_ENV = "development";
    const nodemailer = await import("nodemailer");
    const { sendEmail } = await import("./email.server");

    await sendEmail("test@example.com", "Test", "<p>Hi</p>", "Hi");

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("magicLinkTemplate includes link and expiry note", async () => {
    const { magicLinkTemplate } = await import("./email.server");
    const { html, text } = magicLinkTemplate("https://trails.cool/auth/verify?token=abc");

    expect(html).toContain("https://trails.cool/auth/verify?token=abc");
    expect(html).toContain("15 minutes");
    expect(text).toContain("https://trails.cool/auth/verify?token=abc");
    expect(text).toContain("15 minutes");
  });

  it("welcomeTemplate includes username", async () => {
    const { welcomeTemplate } = await import("./email.server");
    const { html, text } = welcomeTemplate("Alice");

    expect(html).toContain("Alice");
    expect(text).toContain("Alice");
    expect(html).toContain("trails.cool");
  });
});
