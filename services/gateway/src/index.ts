import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createHonoRequestLogger } from "@ikyomm/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createNotFoundHandler,
  createOpenApiDocsHandler,
} from "@ikyomm/utils";
import { openApiInfo } from "@/config/openapi";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { logGatewayProxyRoutes, registerGatewayRoutes } from "@/routes";
import { registerGatewaySocketProxy } from "@/socket-proxy";

const app = new OpenAPIHono();
applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  globalRateLimitSkipPaths: ["/api/ommpods/polling"],
});
app.use("*", createHonoRequestLogger(logger));
registerGatewayRoutes(app);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "gateway", logger }));

/* openapi */
app.doc("/doc", openApiInfo);
app.get(
  "/",
  createOpenApiDocsHandler({
    theme: "purple",
    pageTitle: "Ikyomm Gateway Service API",
    hideClientButton: true,
    sources: [
      {
        title: "Gateway",
        url: "./doc",
        default: true,
      },
      {
        title: "Auth Service",
        url: "/api/auth/open-api/generate-schema",
      },
      {
        title: "Kernel Service",
        url: "/api/kernel/doc",
      },
      {
        title: "Company Service",
        url: "/api/company/doc",
      },
      {
        title: "Ommpods Service",
        url: "/api/ommpods/doc",
      },
      {
        title: "Ecommerce Service",
        url: "/api/ecommerce/doc",
      },
    ],
  })
);

const server = serve({ fetch: app.fetch, port: env.PORT }, () => {
  logger.info("service started", {
    port: env.PORT,
    baseUrl: `http://localhost:${env.PORT}`,
    healthPath: "/health",
  });
  logGatewayProxyRoutes();
});

registerGatewaySocketProxy(server);

export default app;
