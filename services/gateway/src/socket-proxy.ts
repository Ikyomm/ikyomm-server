import type { IncomingMessage } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { Socket } from "node:net";
import { logger } from "@/lib/logger";
import { createUpstreamUrl, proxyRoutes } from "@/proxy";

const OMMPODS_SOCKET_PATH_PATTERN = /^\/api\/ommpods\/socket\/pods\/[^/]+$/;

type UpgradeCapableServer = {
  on(
    event: "upgrade",
    listener: (request: IncomingMessage, socket: Socket, head: Buffer) => void
  ): unknown;
};

function getIncomingUrl(request: IncomingMessage) {
  const host = request.headers.host ?? "localhost";
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" && forwardedProto
      ? forwardedProto.split(",")[0]?.trim() || "http"
      : "http";

  return new URL(request.url ?? "/", `${protocol}://${host}`);
}

function getOmmpodsProxyRoute() {
  return proxyRoutes.find((route) => route.prefix === "/api/ommpods") ?? null;
}

function writeUpgradeError(socket: Socket, status: number, message: string) {
  if (socket.destroyed) {
    return;
  }

  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

function buildUpgradeHeaders(
  request: IncomingMessage,
  upstreamUrl: URL,
  incomingUrl: URL,
  routePrefix: string
) {
  const headers = {
    ...request.headers,
    connection: "Upgrade",
    host: upstreamUrl.host,
    upgrade: "websocket",
    "x-forwarded-host": incomingUrl.host,
    "x-forwarded-prefix": routePrefix,
    "x-forwarded-proto": incomingUrl.protocol.replace(":", ""),
  };

  delete headers["content-length"];
  return headers;
}

function writeSwitchingProtocolsResponse(
  socket: Socket,
  response: IncomingMessage,
  upstreamHead: Buffer
) {
  socket.write("HTTP/1.1 101 Switching Protocols\r\n");

  for (const [name, value] of Object.entries(response.headers)) {
    if (typeof value === "undefined") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        socket.write(`${name}: ${item}\r\n`);
      }
    } else {
      socket.write(`${name}: ${value}\r\n`);
    }
  }

  socket.write("\r\n");
  if (upstreamHead.length > 0) {
    socket.write(upstreamHead);
  }
}

function proxyOmmpodsSocketUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
  const incomingUrl = getIncomingUrl(request);

  if (!OMMPODS_SOCKET_PATH_PATTERN.test(incomingUrl.pathname)) {
    return false;
  }

  const route = getOmmpodsProxyRoute();
  if (!route) {
    writeUpgradeError(socket, 502, "Bad Gateway");
    return true;
  }

  const upstreamUrl = new URL(createUpstreamUrl(incomingUrl.toString(), route));
  const requestImpl = upstreamUrl.protocol === "https:" ? httpsRequest : httpRequest;
  const upstreamRequest = requestImpl({
    headers: buildUpgradeHeaders(request, upstreamUrl, incomingUrl, route.prefix),
    hostname: upstreamUrl.hostname,
    method: "GET",
    path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
    port: upstreamUrl.port || undefined,
    protocol: upstreamUrl.protocol,
  });

  upstreamRequest.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
    logger.info("proxied websocket upgrade", {
      path: incomingUrl.pathname,
      target: route.target,
      upstreamPath: upstreamUrl.pathname,
    });

    writeSwitchingProtocolsResponse(socket, upstreamResponse, upstreamHead);

    if (head.length > 0) {
      upstreamSocket.write(head);
    }

    socket.pipe(upstreamSocket);
    upstreamSocket.pipe(socket);
  });

  upstreamRequest.on("response", (response) => {
    logger.warn("websocket upstream did not upgrade", {
      path: incomingUrl.pathname,
      status: response.statusCode,
      target: route.target,
    });

    response.resume();
    writeUpgradeError(socket, response.statusCode ?? 502, response.statusMessage ?? "Bad Gateway");
  });

  upstreamRequest.on("error", (error) => {
    logger.error("websocket upstream request failed", {
      path: incomingUrl.pathname,
      target: route.target,
      error,
    });

    writeUpgradeError(socket, 502, "Bad Gateway");
  });

  upstreamRequest.end();
  return true;
}

export function registerGatewaySocketProxy(server: UpgradeCapableServer) {
  server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const handled = proxyOmmpodsSocketUpgrade(request, socket, head);

    if (!handled) {
      writeUpgradeError(socket, 404, "Not Found");
    }
  });
}
