/** biome-ignore-all lint/suspicious/noTsIgnore: forced */
import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
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
import { logger } from "@/lib/logger";
import { companyGroup } from "@/routers/company";
import { ikyommGroup } from "@/routers/ikyomm";
import { locationGroup } from "@/routers/location";
import { recordsGroup } from "@/routers/records";
import { walletsGroup } from "@/routers/wallets";
import type { AppBindings } from "@/types/app";
import { openApiInfo } from "./config/openapi";

const app = new OpenAPIHono<AppBindings>();

applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
});

app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get(
  "/health",
  createHealthCheckHandler({
    serviceName: "kernel",
    includeConnectionInfo: true,
  })
);
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

const routes = app
  .route("/company", companyGroup)
  .route("/ikyomm", ikyommGroup)
  .route("/location", locationGroup)
  .route("/ommpods", ikyommGroup)
  .route("/records", recordsGroup)
  .route("/wallets", walletsGroup);

app.doc("/doc", openApiInfo);
const docsHandler = createOpenApiDocsHandler({
  specUrl: "./doc",
  pageTitle: "Ommpods Kernel Service API",
  hideClientButton: true,
});

app.get("/", docsHandler);
app.get("/docs", docsHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "kernel", logger }));

await initDB({ logger, serviceName: "kernel" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export type AppType = typeof routes;

export default app;
