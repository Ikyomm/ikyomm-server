# `@ikyomm/mqtt`

Small shared MQTT connection package for backend services in this workspace.

It wraps the `mqtt` client with:

- connection start/stop helpers
- reconnect logging
- connect and message listeners
- publish and subscribe promises
- optional last-will support

## Ommpods broker

Current OMMPods broker configuration:

- TCP broker host: `172.105.41.17`
- TCP broker port: `1883`
- WebSocket broker port: `9001`
- Username/password: not used

Use TCP from backend services:

```env
OMMPODS_MQTT_ENABLED=true
OMMPODS_MQTT_SERVER=172.105.41.17
OMMPODS_MQTT_PORT=1883
OMMPODS_MQTT_WS_PORT=9001
OMMPODS_MQTT_CLIENT_ID_PREFIX=ommpods-service
OMMPODS_MQTT_STATUS_TOPIC=ommpod/pod/status
OMMPODS_MQTT_QOS=1
```

Use WebSocket from browser-based clients:

- `ws://172.105.41.17:9001`
- if you later put this behind HTTPS, switch browser clients to `wss://`

## Ommpods status topic

The ommpods service currently publishes broker status on:

- topic: `ommpod/pod/status`

Payloads:

- online: `OMMPOD bridge online`
- offline: `OMMPOD bridge offline`

Behavior:

- on successful connect, the service publishes retained `OMMPOD bridge online`
- it also sets a retained last-will `OMMPOD bridge offline`
- on graceful shutdown, it publishes retained `OMMPOD bridge offline` before disconnecting

This makes the latest bridge status readable by late subscribers over both TCP MQTT and MQTT-over-WebSocket.

## Ommpods device topics

The ommpods service also publishes device-facing payloads directly to:

- `ommpod/<podId>/rgb` as `$R|<r>|G|<g>|B|<b>$`
- `ommpod/<podId>/diffuser` as `$DIF|<mac-or-NULL>|<container-or-NULL>$`
- `ommpod/<podId>/timer` as `$SHUT|<remaining-seconds>$`

These payloads are emitted from the internal pod-state refresh flow, so the separate Python bridge is no longer required for MQTT publishing.

## Example

```ts
import { createMqttConnection } from "@ikyomm/mqtt";

const mqtt = createMqttConnection({
  clientId: "example-service",
  url: "mqtt://172.105.41.17:1883",
});

mqtt.onConnect(async () => {
  await mqtt.publish("example/status", "online", {
    qos: 1,
    retain: true,
  });

  await mqtt.subscribe("example/input", { qos: 1 });
});

mqtt.onMessage(async (topic, payload) => {
  console.log(topic, payload.toString());
});

mqtt.start();
```

## Reuse from another service

1. Add `@ikyomm/mqtt` as a workspace dependency.
2. Create one service-local initializer that reads env values and constructs the broker URL.
3. Register `onConnect` to publish any retained status topic.
4. Add a last-will if you need offline visibility.
5. Call `stop()` during service shutdown.

## Verification done

Broker connectivity was verified against the current broker:

- `mqtt://172.105.41.17:1883`
- `ws://172.105.41.17:9001`

The retained payload `OMMPOD bridge online` was published to `ommpod/pod/status` and read back successfully over both transports.
