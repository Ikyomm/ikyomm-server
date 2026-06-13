import { createApiJsonBody, createApiSuccessResponse, createOpenApiRoute } from "@ikyomm/utils";
import { activeSessionParamsSchema } from "../shared";
import {
  aromaControlBodySchema,
  aromaControlResponseSchema,
  moodControlBodySchema,
  moodControlResponseSchema,
} from "./schema";

export const updateMoodRoute = createOpenApiRoute({
  method: "post",
  path: "/moods/sessions/{sessionId}",
  operationId: "ommpodsSessionMoodChange",
  tags: ["Control"],
  summary: "Change active session mood",
  request: {
    params: activeSessionParamsSchema,
    body: createApiJsonBody(moodControlBodySchema),
  },
  responses: {
    200: createApiSuccessResponse(moodControlResponseSchema, "Session mood updated successfully"),
  },
});

export const updateAromaRoute = createOpenApiRoute({
  method: "post",
  path: "/aroma/sessions/{sessionId}",
  operationId: "ommpodsSessionAromaChange",
  tags: ["Control"],
  summary: "Change active session aroma container",
  request: {
    params: activeSessionParamsSchema,
    body: createApiJsonBody(aromaControlBodySchema),
  },
  responses: {
    200: createApiSuccessResponse(aromaControlResponseSchema, "Session aroma updated successfully"),
  },
});
