export type CronRunTrigger = "startup" | "interval";

export type CronRunResult = Record<string, unknown>;

export type CronLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export type CronJobDefinition = {
  name: string;
  intervalMs: number;
  runOnStart?: boolean;
  run: () => Promise<CronRunResult | undefined>;
};

export type CronRegistry = {
  stop: () => void;
};
