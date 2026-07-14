import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { logger } from "@/lib/logger";

const OMMPODS_LEGACY_SOCKET_PATH_PATTERN = /^\/api\/ommpods\/socket\/pods\/[^/]+$/;

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

function writeUpgradeError(socket: Socket, status: number, message: string) {
  if (socket.destroyed) {
    return;
  }

  try {
    socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } catch {
    socket.destroy();
  }
}

function attachUpgradeSocketErrorHandler(socket: Socket, request: IncomingMessage) {
  socket.on("error", (error: Error & { code?: string }) => {
    if (error.code === "ECONNRESET" || error.code === "EPIPE") {
      return;
    }

    logger.warn("gateway upgrade socket error", {
      path: request.url ?? "/",
      code: error.code,
      message: error.message,
    });
  });
}

function proxyOmmpodsSocketUpgrade(request: IncomingMessage, socket: Socket) {
  const incomingUrl = getIncomingUrl(request);

  if (!OMMPODS_LEGACY_SOCKET_PATH_PATTERN.test(incomingUrl.pathname)) {
    return false;
  }

  writeUpgradeError(socket, 410, "Gone");
  return true;
}

export function registerGatewaySocketProxy(server: UpgradeCapableServer) {
  server.on("upgrade", (request: IncomingMessage, socket: Socket) => {
    attachUpgradeSocketErrorHandler(socket, request);

    const handled = proxyOmmpodsSocketUpgrade(request, socket);

    if (!handled) {
      writeUpgradeError(socket, 404, "Not Found");
    }
  });
}
