import {
  connect,
  type IClientOptions,
  type IClientPublishOptions,
  type IClientSubscribeOptions,
  type IPublishPacket,
  type MqttClient,
} from "mqtt";

type MqttLogPayload = Record<string, unknown>;

export interface MqttLogger {
  debug(message: string, payload?: MqttLogPayload): void;
  info(message: string, payload?: MqttLogPayload): void;
  warn(message: string, payload?: MqttLogPayload): void;
  error(message: string, payload?: MqttLogPayload): void;
}

export interface CreateMqttConnectionOptions {
  url: string;
  clientId: string;
  username?: string;
  password?: string;
  logger?: MqttLogger;
  keepaliveSeconds?: number;
  reconnectPeriodMs?: number;
  connectTimeoutMs?: number;
  clean?: boolean;
  queueQosZero?: boolean;
  will?: IClientOptions["will"];
}

type ConnectListener = () => void | Promise<void>;
type MessageListener = (
  topic: string,
  payload: Buffer,
  packet: IPublishPacket
) => void | Promise<void>;

function redactMqttUrl(value: string) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return "[invalid MQTT URL]";
  }
}

export class MqttConnection {
  readonly #options: CreateMqttConnectionOptions;
  readonly #connectListeners = new Set<ConnectListener>();
  readonly #messageListeners = new Set<MessageListener>();
  #client: MqttClient | null = null;

  constructor(options: CreateMqttConnectionOptions) {
    this.#options = options;
  }

  get connected() {
    return this.#client?.connected ?? false;
  }

  start() {
    if (this.#client) {
      return;
    }

    const client = connect(this.#options.url, {
      clean: this.#options.clean ?? true,
      clientId: this.#options.clientId,
      connectTimeout: this.#options.connectTimeoutMs ?? 10_000,
      keepalive: this.#options.keepaliveSeconds ?? 60,
      password: this.#options.password,
      queueQoSZero: this.#options.queueQosZero ?? false,
      reconnectPeriod: this.#options.reconnectPeriodMs ?? 1_000,
      username: this.#options.username,
      will: this.#options.will,
    });

    this.#client = client;

    client.on("connect", () => {
      this.#options.logger?.info("mqtt connected", {
        clientId: this.#options.clientId,
        url: redactMqttUrl(this.#options.url),
      });

      for (const listener of this.#connectListeners) {
        Promise.resolve(listener()).catch((error) => {
          this.#options.logger?.error("mqtt connect listener failed", { error });
        });
      }
    });
    client.on("reconnect", () => {
      this.#options.logger?.debug("mqtt reconnecting", {
        clientId: this.#options.clientId,
      });
    });
    client.on("offline", () => {
      this.#options.logger?.warn("mqtt offline", {
        clientId: this.#options.clientId,
      });
    });
    client.on("error", (error) => {
      this.#options.logger?.error("mqtt connection error", {
        clientId: this.#options.clientId,
        error,
      });
    });
    client.on("message", (topic, payload, packet) => {
      for (const listener of this.#messageListeners) {
        Promise.resolve(listener(topic, payload, packet)).catch((error) => {
          this.#options.logger?.error("mqtt message listener failed", {
            error,
            topic,
          });
        });
      }
    });
  }

  onConnect(listener: ConnectListener) {
    this.#connectListeners.add(listener);
    return () => this.#connectListeners.delete(listener);
  }

  onMessage(listener: MessageListener) {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  async publish(topic: string, payload: string | Buffer, options: IClientPublishOptions = {}) {
    const client = this.#getClient();

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, options, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async subscribe(topic: string | string[], options: IClientSubscribeOptions = { qos: 0 }) {
    const client = this.#getClient();

    await new Promise<void>((resolve, reject) => {
      client.subscribe(topic, options, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async stop(force = false) {
    const client = this.#client;
    this.#client = null;

    if (!client) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      client.end(force, {}, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  #getClient() {
    if (!this.#client) {
      throw new Error("MQTT connection has not been started");
    }

    return this.#client;
  }
}

export function createMqttConnection(options: CreateMqttConnectionOptions) {
  return new MqttConnection(options);
}

export type { IClientPublishOptions, IClientSubscribeOptions } from "mqtt";
