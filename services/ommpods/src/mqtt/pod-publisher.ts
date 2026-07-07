import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { subscribeToPodStateUpdates, type PodState } from "@/pod-state";
import { getOmmpodsMqtt } from "./index";

const MQTT_NULL_TEXT = "NULL";
const MQTT_TOPIC_PREFIX = "ommpod";
const MQTT_TOPIC_TYPES = ["rgb", "diffuser", "timer"] as const;

type PollingTopicType = (typeof MQTT_TOPIC_TYPES)[number];
type PollingPayloadMap = Record<PollingTopicType, string>;

const lastPublishedPayloads = new Map<string, string>();
let isPodPublisherInitialized = false;

function getPayloadCacheKey(podId: string, topicType: PollingTopicType) {
  return `${podId}:${topicType}`;
}

function getPayloadTopic(podId: string, topicType: PollingTopicType) {
  return `${MQTT_TOPIC_PREFIX}/${podId}/${topicType}`;
}

function safeInt(value: unknown, defaultValue = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : defaultValue;
}

function valueOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return MQTT_NULL_TEXT;
  }

  return String(value);
}

function buildDevicePayloads(data: PodState): PollingPayloadMap {
  const aromaDiffuser = data.podData.aromaDufuser;
  const remaining =
    data.session?.remaining ??
    data.sessionEndingDelay?.remaining ??
    data.sessionStartingDelay?.remaining ??
    0;

  return {
    rgb: `$R|${safeInt(data.r)}|G|${safeInt(data.g)}|B|${safeInt(data.b)}$`,
    diffuser: `$DIF|${valueOrNull(aromaDiffuser.activeDefuserMacId)}|${valueOrNull(
      aromaDiffuser.activeDufuserContainerNumber
    )}$`,
    timer: `$SHUT|${safeInt(remaining)}$`,
  };
}

async function publishPodStateToMqtt(podId: string, data: PodState) {
  if (!env.MQTT_ENABLED) {
    return;
  }

  const connection = getOmmpodsMqtt();
  if (!connection?.connected) {
    return;
  }

  const payloads = buildDevicePayloads(data);
  const qos = env.MQTT_QOS as 0 | 1 | 2;

  await Promise.all(
    MQTT_TOPIC_TYPES.map(async (topicType) => {
      const payload = payloads[topicType];
      const cacheKey = getPayloadCacheKey(podId, topicType);

      if (lastPublishedPayloads.get(cacheKey) === payload) {
        return;
      }

      await connection.publish(getPayloadTopic(podId, topicType), payload, {
        qos,
        retain: false,
      });

      lastPublishedPayloads.set(cacheKey, payload);
      logger.debug("ommpods mqtt pod payload published", {
        payload,
        podId,
        topic: getPayloadTopic(podId, topicType),
      });
    })
  );
}

export function initializeOmmpodsPodMqttPublisher() {
  if (isPodPublisherInitialized) {
    return;
  }

  isPodPublisherInitialized = true;

  subscribeToPodStateUpdates((podId, data) => {
    void publishPodStateToMqtt(podId, data).catch((error) => {
      logger.warn("failed to publish pod state over mqtt", {
        podId,
        error,
      });
    });
  });
}
