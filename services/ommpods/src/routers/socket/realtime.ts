import { WebSocket } from "ws";
import type { PodSocketState } from "./state";

const subscribers = new Map<string, Set<WebSocket>>();

export function sendPodSocketState(socket: WebSocket, data: PodSocketState) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(data));
}

export function subscribeToPodSocketState(podId: string, socket: WebSocket) {
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

export function broadcastPodSocketState(podId: string, data: PodSocketState) {
  const podSubscribers = subscribers.get(podId);

  if (!podSubscribers) {
    return;
  }

  for (const socket of podSubscribers) {
    sendPodSocketState(socket, data);
  }
}

export function getPodSocketSubscriberCount(podId: string) {
  return subscribers.get(podId)?.size ?? 0;
}
