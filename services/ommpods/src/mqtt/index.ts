import mqtt, { type MqttClient } from "mqtt";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { subscribeToPollingStateUpdates } from "../routers/polling/state";
import type { PollingResponse } from "../routers/polling/schema";

let client: MqttClient | null = null;
let isInitialized = false;

type CachedPodHardwareState = {
  remaining: number;
  r: number;
  g: number;
  b: number;
  activeDefuserMacId: string | null;
  activeDufuserContainerNumber: number | null;
};

const lastPublishedState = new Map<string, CachedPodHardwareState>();

export function getMqttClient(): MqttClient | null {
  return client;
}

export function publishMqtt(topic: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    if (!client?.connected) {
      logger.warn("ommpods mqtt client not connected, skipping publish", { topic, message });
      return resolve();
    }

    client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        logger.error("failed to publish ommpods mqtt message", {
          topic,
          message,
          error: err.message,
        });
      } else {
        logger.info("ommpods mqtt published", { topic, message });
      }
      resolve();
    });
  });
}

const doorLockTimers = new Map<string, NodeJS.Timeout>();

export async function publishDoorUnlock(podId: string): Promise<void> {
  logger.info("ommpods: unlocking door (DOUT1 LOW)", { podId });
  await publishMqtt(`ommpod/${podId}/cmd`, "$DOUT1_LOW$");
}

export async function publishDoorLock(podId: string): Promise<void> {
  logger.info("ommpods: locking door (DOUT1 HIGH)", { podId });
  await publishMqtt(`ommpod/${podId}/cmd`, "$DOUT1_HIGH$");
}

export async function publishDoorUnlockWindow(podId: string, durationSeconds = 30): Promise<void> {
  logger.info("ommpods: starting door unlock window", { podId, durationSeconds });
  const existingTimer = doorLockTimers.get(podId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    doorLockTimers.delete(podId);
  }

  // 1. Immediately unlock door by driving DOUT1 LOW
  await publishDoorUnlock(podId);

  // 2. Schedule automatic lock after durationSeconds
  const timer = setTimeout(() => {
    doorLockTimers.delete(podId);
    publishDoorLock(podId).catch((err) => {
      logger.error("ommpods: failed to lock door after window timeout", {
        podId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, durationSeconds * 1000);

  doorLockTimers.set(podId, timer);
}

export async function publishDoorPulse(podId: string): Promise<void> {
  // Use 30-second unlock window so occupant has plenty of time to enter or exit
  await publishDoorUnlockWindow(podId, 30);
}

export async function publishSessionTimer(podId: string, seconds: number): Promise<void> {
  const safeSeconds = Math.max(0, Math.trunc(seconds));
  await publishMqtt(`ommpod/${podId}/timer`, `$SHUT|${safeSeconds}$`);
}

export async function publishResetTimer(podId: string): Promise<void> {
  await publishMqtt(`ommpod/${podId}/timer`, "$SHUT|0$");
}

export async function publishRgb(podId: string, r: number, g: number, b: number): Promise<void> {
  const safeR = Math.min(255, Math.max(0, Math.trunc(r)));
  const safeG = Math.min(255, Math.max(0, Math.trunc(g)));
  const safeB = Math.min(255, Math.max(0, Math.trunc(b)));
  await publishMqtt(`ommpod/${podId}/rgb`, `$R|${safeR}|G|${safeG}|B|${safeB}$`);
}

export async function publishDiffuser(
  podId: string,
  macId: string,
  containerNumber: number
): Promise<void> {
  await publishMqtt(`ommpod/${podId}/diffuser`, `$DIF|${macId}|${containerNumber}$`);
}

export async function publishDiffuserOff(podId: string, macId: string): Promise<void> {
  await publishMqtt(`ommpod/${podId}/diffuser`, `$DIF|${macId}|0$`);
}

export async function closeOmmpodsMqtt(): Promise<void> {
  if (!client) {
    return;
  }
  return new Promise((resolve) => {
    client?.end(false, () => {
      logger.info("ommpods mqtt client closed");
      resolve();
    });
  });
}

async function handlePollingStateUpdate(podId: string, data: PollingResponse) {
  const previous = lastPublishedState.get(podId);

  if (data.session) {
    const remaining = data.session.remaining;
    const { r, g, b } = data;
    const activeMac = data.podData?.aromaDufuser?.activeDefuserMacId ?? null;
    const activeContainer = data.podData?.aromaDufuser?.activeDufuserContainerNumber ?? null;

    // 1. Timer update
    if (!previous || Math.abs(previous.remaining - remaining) >= 2) {
      await publishSessionTimer(podId, remaining);
    }

    // 2. RGB update
    if (!previous || previous.r !== r || previous.g !== g || previous.b !== b) {
      await publishRgb(podId, r, g, b);
    }

    // 3. Aroma Diffuser update
    if (activeMac && activeContainer !== null) {
      if (previous?.activeDefuserMacId && previous.activeDefuserMacId !== activeMac) {
        await publishDiffuserOff(podId, previous.activeDefuserMacId);
      }
      if (
        !previous ||
        previous.activeDefuserMacId !== activeMac ||
        previous.activeDufuserContainerNumber !== activeContainer
      ) {
        await publishDiffuser(podId, activeMac, activeContainer);
      }
    } else if (previous?.activeDefuserMacId && previous.activeDufuserContainerNumber !== null) {
      await publishDiffuserOff(podId, previous.activeDefuserMacId);
    }

    lastPublishedState.set(podId, {
      remaining,
      r,
      g,
      b,
      activeDefuserMacId: activeMac,
      activeDufuserContainerNumber: activeContainer,
    });
  } else if (previous) {
    // Session just ended or went to idle - unlock door so occupant can exit
    await publishDoorPulse(podId);
    await publishResetTimer(podId);
    await publishRgb(podId, 255, 255, 255);
    if (previous.activeDefuserMacId) {
      await publishDiffuserOff(podId, previous.activeDefuserMacId);
    }
    lastPublishedState.delete(podId);
  }
}

export function initializeOmmpodsMqtt(): void {
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  if (env.MQTT_ENABLED === false) {
    logger.info("ommpods mqtt disabled by configuration");
    return;
  }

  const brokerHost = env.MQTT_HOST || "172.105.51.188";
  const brokerPort = env.MQTT_PORT || 6840;
  const brokerUrl = `mqtt://${brokerHost}:${brokerPort}`;
  const clientId = `ommpods-service-${Math.random().toString(36).substring(2, 9)}`;

  logger.info("ommpods: connecting to mqtt broker", { brokerUrl, clientId });

  try {
    client = mqtt.connect(brokerUrl, {
      clientId,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
    });

    client.on("connect", () => {
      logger.info("ommpods: connected to mqtt broker successfully", { brokerUrl });
    });

    client.on("reconnect", () => {
      logger.debug("ommpods: reconnecting to mqtt broker", { brokerUrl });
    });

    client.on("offline", () => {
      logger.warn("ommpods: mqtt broker offline", { brokerUrl });
    });

    client.on("error", (err) => {
      logger.error("ommpods: mqtt client error", { brokerUrl, error: err.message });
    });

    // Wire up the state change listener so all sessions and tablet writes broadcast to hardware
    subscribeToPollingStateUpdates((podId, data) => {
      handlePollingStateUpdate(podId, data).catch((err) => {
        logger.error("ommpods: failed to handle polling state update for mqtt", {
          podId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
  } catch (err: unknown) {
    logger.error("ommpods: failed to initialize mqtt client", {
      brokerUrl,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
