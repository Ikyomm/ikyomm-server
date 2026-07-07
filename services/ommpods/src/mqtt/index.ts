import { randomUUID } from "node:crypto";
import { createMqttConnection } from "@ikyomm/mqtt";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { initializeOmmpodsPodMqttPublisher } from "./pod-publisher";

const ONLINE_STATUS = "OMMPOD bridge online";
const OFFLINE_STATUS = "OMMPOD bridge offline";

let connection: ReturnType<typeof createMqttConnection> | null = null;

export function initializeOmmpodsMqtt() {
  if (!env.MQTT_ENABLED) {
    logger.info("mqtt integration disabled");
    return null;
  }

  if (connection) {
    return connection;
  }

  const qos = env.MQTT_QOS as 0 | 1 | 2;
  const clientId = `${env.MQTT_CLIENT_ID_PREFIX}-${randomUUID().slice(0, 8)}`;

  connection = createMqttConnection({
    clientId,
    logger,
    url: `mqtt://${env.MQTT_SERVER}:${env.MQTT_PORT}`,
    will: {
      payload: Buffer.from(OFFLINE_STATUS),
      qos,
      retain: true,
      topic: env.MQTT_STATUS_TOPIC,
    },
  });

  connection.onConnect(async () => {
    await connection?.publish(env.MQTT_STATUS_TOPIC, ONLINE_STATUS, {
      qos,
      retain: true,
    });
    logger.info("ommpods mqtt status published", {
      status: ONLINE_STATUS,
      topic: env.MQTT_STATUS_TOPIC,
    });
  });
  connection.start();
  initializeOmmpodsPodMqttPublisher();

  logger.info("ommpods mqtt initialized", {
    server: env.MQTT_SERVER,
    tcpPort: env.MQTT_PORT,
    websocketPort: env.MQTT_WS_PORT,
  });

  return connection;
}

export function getOmmpodsMqtt() {
  return connection;
}

export async function closeOmmpodsMqtt() {
  const activeConnection = connection;
  connection = null;

  if (!activeConnection) {
    return;
  }

  if (activeConnection.connected) {
    await activeConnection.publish(env.MQTT_STATUS_TOPIC, OFFLINE_STATUS, {
      qos: env.MQTT_QOS as 0 | 1 | 2,
      retain: true,
    });
  }

  await activeConnection.stop();
}
