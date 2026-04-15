import { createTransport, type Transporter } from "nodemailer";
import { logger } from "./logger.server";

const FROM = process.env.SMTP_FROM ?? "trails.cool <noreply@trails.cool>";

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    const url = process.env.SMTP_URL;
    if (!url) throw new Error("SMTP_URL is not set");
    transporter = createTransport(url);
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.info({ to, subject }, "Email sent (dev mode — logged, not delivered)");
    logger.debug({ text }, "Email text content");
    return;
  }

  await getTransporter().sendMail({ from: FROM, to, subject, html, text });
}

// --- Templates ---

export function magicLinkTemplate(link: string, code?: string): { html: string; text: string } {
  const codeSection = code
    ? `<p style="color: #555; line-height: 1.6;">Or enter this code on the login page:</p>
       <div style="margin: 16px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
         <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${code}</span>
       </div>`
    : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; font-weight: 600; color: #111;">Sign in to trails.cool</h1>
      <p style="color: #555; line-height: 1.6;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
      <a href="${link}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Sign In</a>
      ${codeSection}
      <p style="color: #888; font-size: 14px;">If the button doesn't work, copy and paste this link:<br/><a href="${link}" style="color: #2563eb;">${link}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="color: #aaa; font-size: 12px;">If you didn't request this link, you can safely ignore this email.</p>
    </div>
  `.trim();

  const codeText = code ? `\nOr enter this code: ${code}\n` : "";

  const text = [
    "Sign in to trails.cool",
    "",
    `Click here to sign in: ${link}`,
    codeText,
    "This link expires in 15 minutes.",
    "",
    "If you didn't request this link, you can safely ignore this email.",
  ].join("\n");

  return { html, text };
}

export function welcomeTemplate(username: string): { html: string; text: string } {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; font-weight: 600; color: #111;">Welcome to trails.cool, ${username}!</h1>
      <p style="color: #555; line-height: 1.6;">Your account is ready. Here's what you can do:</p>
      <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
        <li>Save and manage your routes</li>
        <li>Track outdoor activities</li>
        <li>Plan routes collaboratively in the Planner</li>
        <li>Export routes as GPX for any GPS device</li>
      </ul>
      <a href="https://trails.cool/routes" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">View Your Routes</a>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="color: #aaa; font-size: 12px;">trails.cool — Your outdoor activity journal</p>
    </div>
  `.trim();

  const text = [
    `Welcome to trails.cool, ${username}!`,
    "",
    "Your account is ready. Here's what you can do:",
    "- Save and manage your routes",
    "- Track outdoor activities",
    "- Plan routes collaboratively in the Planner",
    "- Export routes as GPX for any GPS device",
    "",
    "View your routes: https://trails.cool/routes",
  ].join("\n");

  return { html, text };
}

// --- Convenience wrappers ---

export async function sendMagicLink(email: string, link: string, code?: string): Promise<void> {
  const { html, text } = magicLinkTemplate(link, code);
  await sendEmail(email, "Sign in to trails.cool", html, text);
}

export async function sendWelcome(email: string, username: string): Promise<void> {
  const { html, text } = welcomeTemplate(username);
  await sendEmail(email, "Welcome to trails.cool!", html, text);
}
