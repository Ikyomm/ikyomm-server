import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { addressesGroup } from "./addresses";
import { brandsGroup } from "./brands";
import { categoriesGroup } from "./categories";
import { inventoryGroup } from "./inventory";
import { ordersGroup } from "./orders";
import { productsGroup } from "./products";
import { reviewsGroup } from "./reviews";
import { subcategoriesGroup } from "./subcategories";
import { subscriptionsGroup } from "./subscriptions";

export const ecommerceRoutes = new OpenAPIHono<AppBindings>();

ecommerceRoutes.route("/", brandsGroup);
ecommerceRoutes.route("/", categoriesGroup);
ecommerceRoutes.route("/", subcategoriesGroup);
ecommerceRoutes.route("/", productsGroup);
ecommerceRoutes.route("/inventory", inventoryGroup);
ecommerceRoutes.route("/orders", ordersGroup);
ecommerceRoutes.route("/addresses", addressesGroup);
ecommerceRoutes.route("/subscriptions", subscriptionsGroup);
ecommerceRoutes.route("/reviews", reviewsGroup);
