import type { CronJobDefinition, CronLogger, CronRegistry, CronRunTrigger } from "./types";

type StartCronJobsOptions = {
  jobs: CronJobDefinition[];
  logger: CronLogger;
};

function createCronExecutor(job: CronJobDefinition, logger: CronLogger) {
  let isRunning = false;

  return async (trigger: CronRunTrigger) => {
    if (isRunning) {
      logger.warn("cron job skipped because previous run is still active", {
        job: job.name,
        trigger,
      });
      return;
    }

    const startedAt = Date.now();
    isRunning = true;

    try {
      const result = await job.run();
      logger.info("cron job completed", {
        job: job.name,
        trigger,
        durationMs: Date.now() - startedAt,
        ...(result ?? {}),
      });
    } catch (error) {
      logger.error("cron job failed", {
        job: job.name,
        trigger,
        durationMs: Date.now() - startedAt,
        error,
      });
    } finally {
      isRunning = false;
    }
  };
}

export function startCronJobs({ jobs, logger }: StartCronJobsOptions): CronRegistry {
  const timers = jobs.map((job) => {
    const execute = createCronExecutor(job, logger);

    if (job.runOnStart) {
      void execute("startup");
    }

    const timer = setInterval(() => {
      void execute("interval");
    }, job.intervalMs);
    timer.unref?.();

    logger.info("cron job scheduled", {
      job: job.name,
      intervalMs: job.intervalMs,
      runOnStart: Boolean(job.runOnStart),
    });

    return timer;
  });

  return {
    stop: () => {
      for (const timer of timers) {
        clearInterval(timer);
      }
    },
  };
}
