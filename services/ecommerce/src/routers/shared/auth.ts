import { createRequiredAuthSessionMiddleware } from "@ikyomm/utils";

export const ecommerceAuthMiddleware = createRequiredAuthSessionMiddleware({
  entities: {
    user: true,
    session: true,
    data: false,
    organization: false,
    hasOrganization: false,
  },
  enableRedisCache: true,
});
