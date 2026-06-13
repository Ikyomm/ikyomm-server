import { startCronJobs } from "./runner";
import { cleanupExpiredSessionsCron } from "./sessions/cleanup-expired-sessions";
import type { CronLogger, CronRegistry } from "./types";

const authCronJobs = [cleanupExpiredSessionsCron];

export function startAuthCrons(options: { logger: CronLogger }): CronRegistry {
  return startCronJobs({
    jobs: authCronJobs,
    logger: options.logger,
  });
}
