# Ecommerce Service

Dedicated Hono/OpenAPI service for the IKYOMM Treasure ecommerce domain.

## Endpoints

- Direct service: `http://localhost:6008`
- Gateway: `http://localhost:8000/api/ecommerce`
- Health: `/health`
- Interactive docs: `/docs`
- OpenAPI document: `/doc`

## API groups

| Group | Base path | Resources |
| --- | --- | --- |
| Brands | `/brands` | brand records |
| Categories | `/categories` | top-level product categories |
| Subcategories | `/subcategories` | subcategories linked to categories |
| Products | `/products` | products and complete product details |
| Product variants | `/product-variants` | SKU variants with embedded attributes |
| Inventory | `/inventory` | warehouses, stocks |
| Orders | `/orders` | orders, items, payments |
| Addresses | `/addresses` | current user's billing and shipping addresses |
| Subscriptions | `/subscriptions` | current user's recurring subscriptions |
| Reviews | `/reviews` | current user's product reviews |

Address lookup routes:

- `GET /addresses/user/{userId}` — active addresses for a user
- `GET /addresses/order/{orderId}` — billing and shipping addresses plus immutable order snapshots

Every resource exposes list, get, create, update, soft-delete, restore, and permanent-delete operations. Brand, category, subcategory, product, and variant reads are public. Their writes and inventory writes require an authenticated IKYOMM staff account and the matching resource permission. User-owned resources are automatically scoped to the authenticated `user.id`. Order items and payments are restricted to orders owned by that user.

Subscription creation verifies the selected variant's product has `isSubscriptionEligible = true`.

## Route pattern

For a resource mounted at `<resource>`:

- `GET <resource>` — paginated list (`limit`, `offset`)
- `GET <resource>/{id}` — get by ID
- `POST <resource>` — create
- `PATCH <resource>/{id}` — update
- `DELETE <resource>/{id}` — soft-delete
- `POST <resource>/{id}/restore` — restore
- `DELETE <resource>/{id}/permanent` — permanently delete an already soft-deleted record

Standard resource lists accept `search`, `sortBy`, `sortOrder`, and `isDeleted` in addition to pagination and return `totalItems`.

Product lists return each product with its embedded `images` array. Variant attributes
are stored in each variant's `attributes` object. Product list
queries additionally support:

- `search`
- `brandId`, `categoryId`, `subcategoryId`
- `productType`, `status`
- `isSubscriptionEligible`, `isHeroProduct`
- `attributeName`, `attributeValue`

Use `GET /products/filter-options` to load the available brands, nested category
and subcategory options, product types, statuses, and variant attribute values.
These read-only searches remain standard `GET` requests so they work consistently
through browsers, caches, proxies, and the generated OpenAPI client.

Examples through the gateway:

```text
GET  /api/ecommerce/brands
GET  /api/ecommerce/categories
GET  /api/ecommerce/subcategories
GET  /api/ecommerce/products?categoryId={id}&subcategoryId={id}&brandId={id}
GET  /api/ecommerce/products?attributeName=size&attributeValue=large
GET  /api/ecommerce/products/filter-options
GET  /api/ecommerce/products/{id}/details
POST /api/ecommerce/orders
GET  /api/ecommerce/subscriptions
GET  /api/ecommerce/docs
```

## Environment

```dotenv
ECOMMERCE_PORT=6008
ECOMMERCE_HOST_PORT=6008
ECOMMERCE_SERVICE_URL=http://localhost:6008
```

The service also requires the shared `DATABASE_URL`, `REDIS_URL`, `AUTH_SERVICE_URL`, logging, and CORS variables.

## Commands

```bash
pnpm dev                         # starts ecommerce with the other services
pnpm build:ecommerce
pnpm type-check:ecommerce
pnpm lint:ecommerce
pnpm health:ecommerce
```
