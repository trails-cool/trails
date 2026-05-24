import type { JobDefinition } from "@trails-cool/jobs";
import { sendWelcome } from "../lib/email.server.ts";
import { logger } from "../lib/logger.server.ts";

interface WelcomeEmailData {
  email: string;
  username: string;
}

/**
 * Queue-backed welcome email send. The old code did
 * `sendWelcome(...).catch(log)` inline, which silently dropped failures.
 * pg-boss retries on transient failure (3 attempts) and surfaces persistent
 * failures via the dead-letter queue / logs.
 */
export const sendWelcomeEmailJob: JobDefinition = {
  name: "send-welcome-email",
  retryLimit: 3,
  expireInSeconds: 120,
  async handler(job) {
    const batch = Array.isArray(job) ? job : [job];
    for (const item of batch) {
      const { email, username } = item.data as WelcomeEmailData;
      try {
        await sendWelcome(email, username);
      } catch (err) {
        logger.error({ err, email }, "send-welcome-email job failed");
        throw err;
      }
    }
  },
};
