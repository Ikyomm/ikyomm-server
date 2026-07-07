import {
  OpenAPIHono as BaseOpenAPIHono,
  type OpenAPIHono as OpenAPIHonoType,
} from "@hono/zod-openapi";
import type { Env, Schema } from "hono";

export type AppOpenAPIHono<
  E extends Env = Env,
  S extends Schema = Record<string, never>,
  BasePath extends string = "/",
> = OpenAPIHonoType<E, S, BasePath> & {
  all: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  doc: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  fetch: (...args: unknown[]) => Response | Promise<Response>;
  get: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  notFound: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  onError: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  post: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  route: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
  use: (...args: unknown[]) => AppOpenAPIHono<E, S, BasePath>;
};

export function createOpenApiHono<
  E extends Env = Env,
  S extends Schema = Record<string, never>,
  BasePath extends string = "/",
>() {
  return new BaseOpenAPIHono<E, S, BasePath>() as AppOpenAPIHono<E, S, BasePath>;
}
