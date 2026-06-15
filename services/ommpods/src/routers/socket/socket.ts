import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { logger } from "@/lib/logger";
import { type WebSocket, WebSocketServer } from "ws";
import {
  broadcastPodSocketState,
  getPodSocketSubscriberCount,
  sendPodSocketState,
  subscribeToPodSocketState,
} from "./realtime";
import { buildPodSocketState } from "./state";

const SOCKET_POD_PATH_PATTERN = /^\/socket\/pods\/([^/]+)$/;
const socketServer = new WebSocketServer({ noServer: true });
const podTickIntervals = new Map<string, ReturnType<typeof setInterval>>();

type UpgradeCapableServer = {
  on(
    event: "upgrade",
    listener: (request: IncomingMessage, socket: Socket, head: Buffer) => void
  ): unknown;
};

function getSocketPodId(request: IncomingMessage) {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const match = requestUrl.pathname.match(SOCKET_POD_PATH_PATTERN);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function startPodTick(podId: string) {
  if (podTickIntervals.has(podId)) {
    return;
  }

  const interval = setInterval(async () => {
    if (getPodSocketSubscriberCount(podId) === 0) {
      clearInterval(interval);
      podTickIntervals.delete(podId);
      return;
    }

    const data = await buildPodSocketState(podId);
    broadcastPodSocketState(podId, data);
  }, 1000);

  podTickIntervals.set(podId, interval);
}

async function sendInitialPodSocketState(podId: string, socket: WebSocket) {
  const data = await buildPodSocketState(podId, { forceRefresh: true });
  sendPodSocketState(socket, data);
}

function acceptSocketConnection(podId: string, socket: WebSocket) {
  const unsubscribe = subscribeToPodSocketState(podId, socket);
  startPodTick(podId);
  sendInitialPodSocketState(podId, socket).catch((error) => {
    logger.warn("failed to send initial ommpods socket state", {
      podId,
      error,
    });
  });

  socket.on("close", unsubscribe);
  socket.on("error", (error) => {
    logger.warn("ommpods socket error", {
      podId,
      error,
    });
    unsubscribe();
  });
}

export function registerOmmpodsSocketServer(server: UpgradeCapableServer) {
  server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const podId = getSocketPodId(request);

    if (!podId) {
      return;
    }

    socketServer.handleUpgrade(request, socket, head, (webSocket) => {
      logger.info("ommpods socket connected", {
        podId,
      });
      acceptSocketConnection(podId, webSocket);
    });
  });
}
