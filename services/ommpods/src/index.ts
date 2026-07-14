/** biome-ignore-all lint/suspicious/noTsIgnore: forced */
import { serve } from "@hono/node-server";
import { initDB } from "@ikyomm/database";
import { createHonoRequestLogger } from "@ikyomm/logger";
import type { Context } from "hono";
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
import { closePodStateTicker, initializePodStateTicker } from "@/pod-state";
import { ommpodsRoutes } from "@/routers";
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

// Legacy routes for backward compatibility
app.get("/polling/pods/:podId/socket-state", (c: Context<AppBindings>) => {
  c.header("X-OMMPods-Legacy", "deprecated");
  c.header("X-OMMPods-Replacement", "mqtt-ws");
  c.header("Cache-Control", "no-store, max-age=0");

  return c.json(
    {
      success: true,
      deprecated: true,
      message: "Legacy polling socket-state route removed. Use MQTT over WebSocket on port 9001.",
      data: {
        podData: {
          connectedDeviceConfig: [],
          aromaDufuser: {
            defuserMacIds: [],
            activeDefuserMacId: null,
            activeDufuserContainerNumber: null,
          },
        },
        r: 0,
        g: 0,
        b: 0,
        moodPresetId: null,
        musicControl: null,
        sessionStartingDelay: null,
        sessionEndingDelay: null,
        session: null,
      },
    },
    200
  );
});

app.get("/socket/pods/:podId", (c: Context<AppBindings>) => {
  c.header("X-OMMPods-Legacy", "deprecated");
  c.header("X-OMMPods-Replacement", "mqtt-ws");
  c.header("Cache-Control", "no-store, max-age=0");

  return c.json(
    {
      success: true,
      deprecated: true,
      message: "Legacy custom socket endpoint removed. Use MQTT over WebSocket on port 9001.",
    },
    200
  );
});
// Legacy routes for backward compatibility

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "ommpods", logger }));

await initDB({ logger, serviceName: "ommpods" });
await initializePodStateTicker();
initializeOmmpodsMqtt();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

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

  try {
    await closePodStateTicker();
  } catch (error) {
    logger.error("failed to close ommpods pod-state ticker cleanly", { error, signal });
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
