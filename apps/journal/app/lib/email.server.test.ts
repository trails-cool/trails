import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nodemailer before importing
vi.mock("nodemailer", () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
  }),
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

  it("logs to console in dev mode", async () => {
    process.env.NODE_ENV = "development";
    const { sendEmail } = await import("./email.server");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendEmail("test@example.com", "Test Subject", "<p>Hello</p>", "Hello");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("test@example.com"),
    );
    consoleSpy.mockRestore();
  });

  it("does not call SMTP in dev mode", async () => {
    process.env.NODE_ENV = "development";
    const nodemailer = await import("nodemailer");
    const { sendEmail } = await import("./email.server");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendEmail("test@example.com", "Test", "<p>Hi</p>", "Hi");

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
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
