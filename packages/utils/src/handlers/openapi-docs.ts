import { Scalar } from "@scalar/hono-api-reference";
import type { Context } from "hono";

type ScalarHandlerOptions = Exclude<Parameters<typeof Scalar>[0], (...args: never[]) => unknown>;

export interface OpenApiDocsHandlerOptions extends Omit<ScalarHandlerOptions, "url"> {
  specUrl?: string;
}

function resolveSpecUrl(specUrl: string, forwardedPrefix: string | undefined) {
  if (
    !forwardedPrefix?.startsWith("/") ||
    forwardedPrefix.startsWith("//") ||
    !(specUrl.startsWith("./") || specUrl.startsWith("/"))
  ) {
    return specUrl;
  }

  const normalizedPrefix = forwardedPrefix.replace(/\/+$/, "");
  const normalizedSpecPath = specUrl.replace(/^\.?\//, "/");

  return `${normalizedPrefix}${normalizedSpecPath}`;
}

export function createOpenApiDocsHandler(options: OpenApiDocsHandlerOptions) {
  const { specUrl = "./doc", ...scalarOptions } = options;

  return Scalar((c: Context) => {
    const resolvedSpecUrl = resolveSpecUrl(specUrl, c.req.header("x-forwarded-prefix"));

    return {
      ...scalarOptions,
      theme: scalarOptions.theme || "purple",
      ...(!("sources" in scalarOptions) ? { url: resolvedSpecUrl } : {}),
    };
  });
}
