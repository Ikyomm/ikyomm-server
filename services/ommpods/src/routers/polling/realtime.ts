import type { PollingResponse } from "./schema";
import { WebSocket } from "ws";

const subscribers = new Map<string, Set<WebSocket>>();

export function sendPollingData(socket: WebSocket, data: PollingResponse) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(data));
}

export function subscribeToPodPolling(podId: string, socket: WebSocket) {
  const podSubscribers = subscribers.get(podId) ?? new Set<WebSocket>();
  podSubscribers.add(socket);
  subscribers.set(podId, podSubscribers);

  return () => {
    podSubscribers.delete(socket);

    if (podSubscribers.size === 0) {
      subscribers.delete(podId);
    }
  };
}

export function broadcastPollingDataForPod(podId: string, data: PollingResponse) {
  const podSubscribers = subscribers.get(podId);

  if (!podSubscribers) {
    return;
  }

  for (const socket of podSubscribers) {
    sendPollingData(socket, data);
  }
}

export function getPodPollingSubscriberCount(podId: string) {
  return subscribers.get(podId)?.size ?? 0;
}
