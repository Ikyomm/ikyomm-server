import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  createFaviconHandler,
  createHealthCheckHandler,
  resolveClientIpFromHeaderGetter,
} from "@ikyomm/utils";
import { logger } from "@/lib/logger";
import { createUpstreamUrl, proxyRoutes, type ProxyRoute } from "@/proxy";

const GATEWAY_TAG = "Gateway";
const AUTH_PROXY_TAG = "Auth Service (Proxied)";
const AUTH_PANEL_SCOPE_HEADER = "x-auth-panel-scope";
const AUTH_PANEL_SCOPES = new Set(["ikyomm", "company", "app"]);
const CANONICAL_AUTH_COOKIE_PATTERNS = [
  /^better-auth/i,
  /^__Secure-better-auth/i,
  /^__Host-better-auth/i,
] as const;
const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  AUTH_PANEL_SCOPE_HEADER,
]);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const OMMPODS_POLLING_STALE_MAX_AGE_MS = 10_000;
const OMMPODS_POLLING_CACHE_MAX_ENTRIES = 1_000;

type OmmpodsPollingCacheEntry = {
  body: ArrayBuffer;
  updatedAt: number;
};

const ommpodsPollingCache = new Map<string, OmmpodsPollingCacheEntry>();

const gatewayHealthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: [GATEWAY_TAG],
  summary: "Gateway health check",
  description: "Returns health information for the gateway service itself.",
  responses: {
    200: {
      description: "Gateway service health response",
    },
  },
});

const authRootRedirectRoute = createRoute({
  method: "get",
  path: "/api/auth",
  tags: [AUTH_PROXY_TAG],
  summary: "Auth docs entrypoint",
  description: "Redirects to the Auth service documentation endpoint.",
  responses: {
    302: {
      description: "Redirect to /api/auth/docs",
    },
  },
});

const authHealthProxyRoute = createRoute({
  method: "get",
  path: "/api/auth/health",
  tags: [AUTH_PROXY_TAG],
  summary: "Auth health (proxied)",
  description: "Proxies auth service health status through the gateway.",
  responses: {
    200: {
      description: "Auth service health response",
    },
    502: {
      description: "Auth service upstream unavailable",
    },
  },
});

function sanitizeRequestHeaders(source: Headers) {
  const headers = new Headers();

  for (const [key, value] of source.entries()) {
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function isCanonicalAuthCookieName(name: string) {
  return CANONICAL_AUTH_COOKIE_PATTERNS.some((pattern) => pattern.test(name));
}

function normalizeAuthPanelScope(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return AUTH_PANEL_SCOPES.has(normalizedValue) ? normalizedValue : null;
}

function getScopedAuthCookiePrefix(scope: string, name: string) {
  if (name.startsWith("__Secure-")) {
    return `__Secure-${scope}-${name.slice("__Secure-".length)}`;
  }

  if (name.startsWith("__Host-")) {
    return `__Host-${scope}-${name.slice("__Host-".length)}`;
  }

  return `${scope}-${name}`;
}

function getCanonicalAuthCookieName(scope: string, name: string): string | null {
  const securePrefix = `__Secure-${scope}-`;
  if (name.startsWith(securePrefix)) {
    return `__Secure-${name.slice(securePrefix.length)}`;
  }

  const hostPrefix = `__Host-${scope}-`;
  if (name.startsWith(hostPrefix)) {
    return `__Host-${name.slice(hostPrefix.length)}`;
  }

  const defaultPrefix = `${scope}-`;
  if (name.startsWith(defaultPrefix)) {
    return name.slice(defaultPrefix.length);
  }

  return null;
}

function rewriteCookieHeader(cookieHeader: string, authPanelScope: string | null) {
  if (!(cookieHeader && authPanelScope)) {
    return cookieHeader;
  }

  const rewrittenEntries: string[] = [];

  for (const cookieEntry of cookieHeader.split(";")) {
    const trimmedEntry = cookieEntry.trim();

    if (!trimmedEntry) {
      continue;
    }

    const separatorIndex = trimmedEntry.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const name = trimmedEntry.slice(0, separatorIndex);
    const value = trimmedEntry.slice(separatorIndex + 1);
    const canonicalName = getCanonicalAuthCookieName(authPanelScope, name);

    if (canonicalName) {
      if (isCanonicalAuthCookieName(canonicalName)) {
        rewrittenEntries.push(`${canonicalName}=${value}`);
      }
      continue;
    }

    if (!isCanonicalAuthCookieName(name)) {
      rewrittenEntries.push(`${name}=${value}`);
    }
  }

  return rewrittenEntries.join("; ");
}

function rewriteSetCookieHeader(setCookie: string, authPanelScope: string | null) {
  if (!authPanelScope) {
    return setCookie;
  }

  const separatorIndex = setCookie.indexOf("=");

  if (separatorIndex < 0) {
    return setCookie;
  }

  const name = setCookie.slice(0, separatorIndex);

  if (!isCanonicalAuthCookieName(name)) {
    return setCookie;
  }

  return `${getScopedAuthCookiePrefix(authPanelScope, name)}${setCookie.slice(separatorIndex)}`;
}

function sanitizeResponseHeaders(source: Headers, authPanelScope: string | null) {
  const headers = new Headers();
  const responseHeaders = source as Headers & {
    getSetCookie?: () => string[];
  };

  for (const [key, value] of source.entries()) {
    const normalizedKey = key.toLowerCase();

    if (HOP_BY_HOP_RESPONSE_HEADERS.has(normalizedKey) || normalizedKey === "set-cookie") {
      continue;
    }

    headers.set(key, value);
  }

  if (typeof responseHeaders.getSetCookie === "function") {
    for (const cookie of responseHeaders.getSetCookie()) {
      headers.append("set-cookie", rewriteSetCookieHeader(cookie, authPanelScope));
    }
  } else {
    const setCookie = source.get("set-cookie");

    if (setCookie) {
      headers.append("set-cookie", rewriteSetCookieHeader(setCookie, authPanelScope));
    }
  }

  return headers;
}

function isOmmpodsPollingRequest(c: Context, route: ProxyRoute) {
  if (c.req.method !== "GET" || route.prefix !== "/api/ommpods") {
    return false;
  }

  const pathname = new URL(c.req.url).pathname;
  return /^\/api\/ommpods\/polling\/pods\/[^/]+$/.test(pathname);
}

function getOmmpodsPollingCacheKey(c: Context) {
  return new URL(c.req.url).pathname;
}

function setOmmpodsPollingCache(c: Context, body: ArrayBuffer) {
  const key = getOmmpodsPollingCacheKey(c);

  if (
    !ommpodsPollingCache.has(key) &&
    ommpodsPollingCache.size >= OMMPODS_POLLING_CACHE_MAX_ENTRIES
  ) {
    const oldestKey = ommpodsPollingCache.keys().next().value;
    if (oldestKey) {
      ommpodsPollingCache.delete(oldestKey);
    }
  }

  ommpodsPollingCache.set(key, {
    body,
    updatedAt: Date.now(),
  });
}

function canCacheOmmpodsPollingResponse(response: Response) {
  const source = response.headers.get("X-OMMPods-Polling-Source");
  return source !== "safe-default" && source !== "gateway-safe-default";
}

function getOmmpodsPollingCachedResponse(c: Context) {
  const cached = ommpodsPollingCache.get(getOmmpodsPollingCacheKey(c));

  if (!cached || Date.now() - cached.updatedAt > OMMPODS_POLLING_STALE_MAX_AGE_MS) {
    return null;
  }

  return new Response(cached.body.slice(0), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
      "X-OMMPods-Polling-Source": "gateway-stale",
    },
  });
}

function createOmmpodsPollingFallbackResponse(c: Context, error: unknown) {
  const podId = new URL(c.req.url).pathname.split("/").at(-1) ?? "unknown";
  const cachedResponse = getOmmpodsPollingCachedResponse(c);

  if (cachedResponse) {
    logger.warn("ommpods polling upstream unavailable; serving stale gateway cache", {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      podId,
      error,
    });

    return cachedResponse;
  }

  logger.warn("ommpods polling upstream unavailable; serving safe fallback", {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    podId,
    error,
  });

  c.header("Cache-Control", "no-store, max-age=0");
  c.header("X-OMMPods-Polling-Source", "gateway-safe-default");

  return c.json(
    {
      success: true,
      data: {
        podData: {
          connectedDeviceConfig: [],
          aromaDufuser: {
            defuserMacId: null,
            activeDufuserContainerNumber: null,
          },
        },
        r: 255,
        g: 255,
        b: 255,
        sessionStartingDelay: null,
        sessionEndingDelay: null,
        session: null,
      },
    },
    200
  );
}

function createProxyHandler(route: ProxyRoute) {
  return async (c: Context) => {
    try {
      const upstreamUrl = createUpstreamUrl(c.req.url, route);
      const headers = sanitizeRequestHeaders(c.req.raw.headers);
      const authPanelScope = normalizeAuthPanelScope(c.req.header(AUTH_PANEL_SCOPE_HEADER) ?? null);
      const clientIp =
        resolveClientIpFromHeaderGetter((headerName) => c.req.header(headerName)) ?? "127.0.0.1";
      const cookieHeader = headers.get("cookie");

      headers.set("host", new URL(route.target).host);
      headers.set("accept-encoding", "identity");
      headers.set("x-forwarded-host", new URL(c.req.url).host);
      headers.set("x-forwarded-proto", new URL(c.req.url).protocol.replace(":", ""));
      headers.set("x-forwarded-prefix", route.prefix);
      headers.set("x-forwarded-for", clientIp);
      headers.set("x-real-ip", clientIp);
      if (cookieHeader) {
        headers.set("cookie", rewriteCookieHeader(cookieHeader, authPanelScope));
      }

      const requestBody =
        c.req.method === "GET" || c.req.method === "HEAD" ? undefined : await c.req.arrayBuffer();

      const response = await fetch(upstreamUrl, {
        method: c.req.method,
        headers,
        body: requestBody,
        redirect: "manual",
        duplex: c.req.method === "GET" || c.req.method === "HEAD" ? undefined : "half",
      });

      logger.info("proxied request", {
        method: c.req.method,
        prefix: route.prefix,
        upstreamPath: new URL(upstreamUrl).pathname,
        status: response.status,
        target: route.target,
      });

      const responseBody =
        c.req.method === "HEAD" || response.status === 204 || response.status === 304
          ? undefined
          : await response.arrayBuffer();
      const isPollingRequest = isOmmpodsPollingRequest(c, route);

      if (isPollingRequest && response.status >= 500) {
        return createOmmpodsPollingFallbackResponse(c, {
          status: response.status,
          statusText: response.statusText,
        });
      }

      if (
        isPollingRequest &&
        response.status === 200 &&
        responseBody &&
        canCacheOmmpodsPollingResponse(response)
      ) {
        setOmmpodsPollingCache(c, responseBody.slice(0));
      }

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeResponseHeaders(response.headers, authPanelScope),
      });
    } catch (error) {
      if (isOmmpodsPollingRequest(c, route)) {
        return createOmmpodsPollingFallbackResponse(c, error);
      }

      logger.error("upstream request failed", {
        method: c.req.method,
        prefix: route.prefix,
        target: route.target,
        error,
      });

      return c.json(
        {
          success: false,
          error: "Bad Gateway",
          message: `Upstream unavailable: ${route.target}`,
        },
        502
      );
    }
  };
}

function getProxyRoute(prefix: string) {
  const route = proxyRoutes.find((candidate) => candidate.prefix === prefix);
  if (!route) {
    throw new Error(`Missing proxy route configuration for prefix: ${prefix}`);
  }

  return route;
}

export function registerGatewayRoutes(app: OpenAPIHono) {
  const faviconHandler = createFaviconHandler();
  const authProxyRoute = getProxyRoute("/api/auth");

  app.openapi(
    gatewayHealthRoute,
    createHealthCheckHandler({
      serviceName: "gateway",
      includeConnectionInfo: true,
    })
  );

  app.get("/favicon.png", faviconHandler);
  app.get("/favicon.ico", faviconHandler);

  app.openapi(authRootRedirectRoute, (c: Context) => c.redirect("/api/auth/docs", 302));
  app.get("/api/auth/", (c: Context) => c.redirect("/api/auth/docs", 302));

  app.openapi(authHealthProxyRoute, createProxyHandler(authProxyRoute));

  for (const route of proxyRoutes) {
    const handler = createProxyHandler(route);
    app.all(route.prefix, handler);
    app.all(`${route.prefix}/*`, handler);
  }
}

export function logGatewayProxyRoutes() {
  for (const route of proxyRoutes) {
    logger.info("proxy route configured", {
      prefix: route.prefix,
      target: route.target,
    });
  }
}
