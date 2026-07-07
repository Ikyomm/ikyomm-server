/** biome-ignore-all lint/suspicious/noTsIgnore: forced */
import { serve } from "@hono/node-server";
import { initDB } from "@ikyomm/database";
import { createHonoRequestLogger } from "@ikyomm/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
  createOpenApiDocsHandler,
} from "@ikyomm/utils";
import { env } from "@/config/env";
import { openApiInfo } from "@/config/openapi";
import { createOpenApiHono } from "@/lib/openapi-hono";
import { logger } from "@/lib/logger";
import { closeOmmpodsMqtt, initializeOmmpodsMqtt } from "@/mqtt";
import { ommpodsRoutes } from "@/routers";
import { registerOmmpodsSocketServer } from "@/routers/socket/socket";
import type { AppBindings } from "@/types/app";

const app = createOpenApiHono<AppBindings>();

applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
});

app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get(
  "/health",
  createHealthCheckHandler({
    serviceName: "ommpods",
    includeConnectionInfo: true,
  })
);
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

const routes = app.route("/", ommpodsRoutes);

app.doc("/doc", openApiInfo);
const docsHandler = createOpenApiDocsHandler({
  specUrl: "./doc",
  pageTitle: "Ommpods Session Service API",
  hideClientButton: true,
});

app.get("/", docsHandler);
app.get("/docs", docsHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "ommpods", logger }));

await initDB({ logger, serviceName: "ommpods" });
initializeOmmpodsMqtt();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

registerOmmpodsSocketServer(server);

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info("ommpods service shutting down", { signal });

  try {
    await closeOmmpodsMqtt();
  } catch (error) {
    logger.error("failed to close ommpods mqtt connection cleanly", { error, signal });
  }

  server.close(() => {
    logger.info("ommpods service stopped", { signal });
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn("forcing ommpods shutdown after timeout", { signal });
    process.exit(1);
  }, 5_000).unref();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

export type AppType = typeof routes;

export default app;
