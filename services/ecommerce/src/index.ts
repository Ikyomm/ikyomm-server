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
import { env } from "./config/env";
import { openApiInfo } from "./config/openapi";
import { logger } from "./lib/logger";
import { ecommerceRoutes } from "./routers";
import type { AppBindings } from "./types/app";

const app = new OpenAPIHono<AppBindings>();

applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
});

app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get(
  "/health",
  createHealthCheckHandler({ serviceName: "ecommerce", includeConnectionInfo: true })
);
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

const routes = app.route("/", ecommerceRoutes);

app.doc("/doc", openApiInfo);
const docsHandler = createOpenApiDocsHandler({
  specUrl: "./doc",
  pageTitle: "IKYOMM Ecommerce Service API",
  hideClientButton: true,
});
app.get("/", docsHandler);
app.get("/docs", docsHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "ecommerce", logger }));

await initDB({ logger, serviceName: "ecommerce" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export type AppType = typeof routes;
export default app;
