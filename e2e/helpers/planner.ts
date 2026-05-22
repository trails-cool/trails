import type { APIRequestContext, Page } from "@playwright/test";

export async function createSession(request: APIRequestContext): Promise<string> {
  const response = await request.post("/api/sessions", { data: {} });
  const { url } = await response.json();
  return url;
}

export async function openSession(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.getByText("Connected").waitFor({ timeout: 15000 });
}
