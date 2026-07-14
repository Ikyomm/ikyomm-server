# OMMPods MQTT Work

## Why the earlier issues happened

The warnings and noisy requests were caused by old app/tablet behavior, not by the new server design.

Observed old-client behavior:

- repeated `GET /polling/pods/:podId/socket-state`
- repeated HTTP control writes like:
  - `POST /tablet/pods/:podId/mood`
  - `POST /tablet/pods/:podId/music`

That old client flow was still trying:

- removed polling routes
- legacy HTTP-driven realtime updates

Current server direction is different:

- no polling endpoint for live pod state
- no custom ommpods WebSocket server
- live read/write path should move to MQTT
- app/tablet should connect to the MQTT broker WebSocket port directly

## Final server-side design

This is the current intended backend contract.

### Live transport

- MQTT TCP broker for backend/device integration:
  - `mqtt://172.105.41.17:1883`
- MQTT over WebSocket for app/tablet socket connection:
  - `ws://172.105.41.17:9001`

No username/password is currently configured on the broker.

## What is removed

These are not part of the live flow anymore:

- no HTTP polling route for live pod timer/state
- no custom ommpods WebSocket endpoint
- no gateway fallback cache for ommpods polling

## What still stays HTTP

HTTP is still used for normal business APIs and initial data fetch.

Main HTTP endpoints that remain valid:

- create session:
  - `POST /api/ommpods/sessions`
- emergency unlock by pod:
  - `POST /api/ommpods/sessions/emergency-unlock`
- app catalog/data:
  - `GET /api/ommpods/app/pods/:id`
  - `GET /api/ommpods/app/moods/list`
  - `GET /api/ommpods/app/playlists/list`
  - `GET /api/ommpods/app/musics/list`
  - `GET /api/ommpods/app/sessions/active`

Important:

- session booking still starts from HTTP
- once session/state changes happen, backend publishes live updates over MQTT

## What now happens after session booking

Current server flow:

1. client books session over HTTP
2. ommpods writes session/control state
3. ommpods refreshes pod state
4. pod state is cached in Redis
5. ommpods publishes MQTT state
6. leader ticker keeps timer/state updates stable for active sessions and delay windows

## Redis and timer stability

Server now uses:

- Redis pod state cache
- Redis active-pod set
- Redis dirty-pod set
- Redis leader lock for one active MQTT ticker/publisher instance

Timer stability approach:

- countdown is derived from absolute `startAt/endAt`
- not from decrementing an in-memory counter
- one leader instance publishes timer updates
- ticks are aligned to second boundaries

This avoids:

- timer drift
- duplicate publishers across instances
- unstable countdown from event-loop delays

## MQTT topics published by backend

### Device-facing topics

Per pod:

- `ommpod/<podId>/rgb`
- `ommpod/<podId>/diffuser`
- `ommpod/<podId>/timer`

Bridge status:

- `ommpod/pod/status`

## Payload format

### RGB topic

Topic:

- `ommpod/<podId>/rgb`

Payload:

```text
$R|175|G|157|B|217$
```

### Diffuser topic

Topic:

- `ommpod/<podId>/diffuser`

Payload:

```text
$DIF|AA:BB:CC:DD|2$
```

When inactive:

```text
$DIF|NULL|NULL$
```

### Timer topic

Topic:

- `ommpod/<podId>/timer`

Payload:

```text
$SHUT|1086$
```

Timer priority:

1. active session remaining
2. session ending delay remaining
3. session starting delay remaining
4. `0`

### Bridge status topic

Topic:

- `ommpod/pod/status`

Payloads:

- `OMMPOD bridge online`
- `OMMPOD bridge offline`

Behavior:

- retained online on connect
- retained offline on graceful shutdown
- retained offline as last-will on unexpected disconnect

## MQTT command topics for future app/tablet write operations

The server now accepts MQTT command topics.

### Pod-scoped command topics

- `ommpod/pods/<podId>/commands/mood`
- `ommpod/pods/<podId>/commands/aroma`
- `ommpod/pods/<podId>/commands/music`
- `ommpod/pods/<podId>/commands/emergency-unlock`

Result topic:

- `ommpod/pods/<podId>/command/result`

### Session-scoped command topics

- `ommpod/sessions/<sessionId>/commands/mood`
- `ommpod/sessions/<sessionId>/commands/aroma`
- `ommpod/sessions/<sessionId>/commands/emergency-unlock`

Result topic:

- `ommpod/sessions/<sessionId>/command/result`

## Command payload examples

### Mood command

Topic:

- `ommpod/pods/OMPD000001/commands/mood`

Payload:

```json
{
  "requestId": "req-1",
  "moodPresetId": "MOOD001"
}
```

### Aroma command

Topic:

- `ommpod/pods/OMPD000001/commands/aroma`

Payload:

```json
{
  "requestId": "req-2",
  "aromaDefuserId": "AROMA001",
  "activeDufuserContainerNumber": 2
}
```

Turn aroma off:

```json
{
  "requestId": "req-3",
  "activeDufuserContainerNumber": null
}
```

### Music command

Topic:

- `ommpod/pods/OMPD000001/commands/music`

Payload:

```json
{
  "requestId": "req-4",
  "playlistId": "PLAYLIST001",
  "musicId": "MUSIC001",
  "playbackState": "playing",
  "positionSeconds": 0,
  "volume": 1,
  "outputSource": "speaker",
  "nonce": "music-1"
}
```

### Emergency unlock command

Topic:

- `ommpod/pods/OMPD000001/commands/emergency-unlock`

Payload:

```json
{
  "requestId": "req-5"
}
```

## Command result payload

Success result example:

```json
{
  "success": true,
  "command": "mood",
  "podId": "OMPD000001",
  "sessionId": "OMSESSION1",
  "requestId": "req-1",
  "message": "Command processed",
  "state": {
    "podData": {
      "connectedDeviceConfig": [],
      "aromaDufuser": {
        "defuserMacIds": [],
        "activeDefuserMacId": null,
        "activeDufuserContainerNumber": null
      }
    },
    "r": 255,
    "g": 255,
    "b": 255,
    "moodPresetId": "MOOD001",
    "musicControl": null,
    "sessionStartingDelay": null,
    "sessionEndingDelay": null,
    "session": {
      "id": "OMSESSION1",
      "podId": "OMPD000001",
      "start": "2026-07-08 12:30:00",
      "end": "2026-07-08 13:00:00",
      "remaining": 1086
    }
  },
  "at": "2026-07-08T12:34:56.000Z"
}
```

Error result example:

```json
{
  "success": false,
  "command": "music",
  "podId": "OMPD000001",
  "sessionId": "OMSESSION1",
  "requestId": "req-4",
  "error": {
    "code": "INVALID_MUSIC",
    "message": "Music is not available for the selected playlist"
  },
  "at": "2026-07-08T12:34:56.000Z"
}
```

## App/tablet migration target

Later app/tablet should do this:

1. keep existing HTTP flow for login/session booking/catalog fetch
2. open one MQTT-over-WebSocket connection to `ws://172.105.41.17:9001`
3. subscribe to:
   - `ommpod/<podId>/rgb`
   - `ommpod/<podId>/diffuser`
   - `ommpod/<podId>/timer`
   - optionally `ommpod/pod/status`
4. merge those topic payloads locally into UI state
5. publish write commands to the relevant `commands/...` topic
6. listen for ack/error on the matching `command/result` topic

Recommended frontend model:

- HTTP:
  - auth
  - session booking
  - list/catalog/bootstrap data
- MQTT over WebSocket:
  - live state read from `rgb`, `diffuser`, `timer`
  - live control write
  - command ack/error

## Important server notes

### Server-side fixes already done

- no live polling route remains
- no custom ommpods WebSocket endpoint remains
- MQTT state publishing starts from session/control changes
- tablet mood/aroma/music writes now refresh pod state immediately
- MQTT command topics now also refresh pod state immediately
- one leader instance owns timer publishing
- no extra JSON pod-state publish topic is used for live device state

### Security note

Current broker has no username/password configured.

That is acceptable only for trusted/internal testing.

Before public app/tablet rollout, broker access should be tightened with:

- authentication
- topic-level ACLs
- TLS/WSS if exposed externally

## Final requirement summary

This is the target backend model:

- no polling
- no custom socket server
- session booking over HTTP
- live read over MQTT
- live write over MQTT
- app/tablet socket connection through MQTT WebSocket port `9001`
