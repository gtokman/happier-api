# happier-api

Unofficial JavaScript/TypeScript client for the **Happier Grocery** commerce API
(`ecom-api.getjaldi.com` — a Jaldi/Vendora storefront backend).

```bash
bun add happier-api
```

## Authentication

**Happier has no login endpoint of its own.** The app authenticates against
**Google Identity Platform (Firebase Auth) in multi-tenant mode**, then presents
the resulting Firebase ID token to Happier. That's why a capture filtered to
`ecom-api.getjaldi.com` shows only the token, never the login.

| | |
|---|---|
| Auth host | `www.googleapis.com` (legacy v3 `relyingparty` API — Firebase iOS SDK 10.29.0) |
| Google Cloud project | `upbeat-nova-376618` |
| Identity Platform tenant | `happier-grocery-e8oja` |
| Firebase app id | `1:1025060920555:ios:bd9c0fa95303a4104a72ae` |
| API key restricted to | bundle `com.happier.mobile` |
| Sign-in provider | `password` (email + password) |
| ID token lifetime | 3600s |
| Header Happier reads | `x-vendora-authentication`, **raw token, no `Bearer` prefix** |

The login, on the wire:

```http
POST https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=AIza…
x-ios-bundle-identifier: com.happier.mobile
x-firebase-gmpid: 1:1025060920555:ios:bd9c0fa95303a4104a72ae
content-type: application/json

{"email":"…","password":"…","clientType":"CLIENT_TYPE_IOS",
 "tenantId":"happier-grocery-e8oja","returnSecureToken":true}
```

Two details are load-bearing and easy to get wrong:

- It's the **legacy `/identitytoolkit/v3/relyingparty/*` API on
  `www.googleapis.com`**, not the modern
  `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`.
- The API key is **bundle-restricted**, so `x-ios-bundle-identifier` must be
  sent or Google answers `403`.

This package handles both. Everything is preconfigured — no keys to supply:

```ts
import { HappierClient, signInWithEmailAndPassword } from "happier-api";

// Just the token exchange:
const session = await signInWithEmailAndPassword(email, password);
// → { idToken, refreshToken, uid, email, displayName, expiresAt }

// Or a client that signs in and refreshes tokens for you:
const client = await HappierClient.signIn(email, password);
```

Tokens expire hourly. `HappierClient` refreshes them transparently (concurrent
requests share one in-flight refresh). Persist the **refresh token**, not the ID
token, and skip the password next time:

```ts
const client = HappierClient.fromRefreshToken(process.env.HAPPIER_REFRESH_TOKEN!);
```

Override the key, tenant, bundle id or app id per call if you need to point at a
different Firebase project:

```ts
await signInWithEmailAndPassword(email, password, {
  apiKey: process.env.HAPPIER_FIREBASE_API_KEY,
  tenantId: "some-other-tenant",
});
```

`HAPPIER_FIREBASE_API_KEY` in the environment overrides the built-in key.

Other auth helpers: `signUpWithEmailAndPassword`, `sendPasswordResetEmail`,
`refreshSession`, `getAccountInfo`, `decodeIdToken`, `isIdTokenExpired`.

## The request contract

Every call to `ecom-api.getjaldi.com` carries:

| Header | Value |
|---|---|
| `x-vendora-authentication` | Firebase ID token, raw |
| `business` | `6499aa6a78f0258111803a89` (Happier Grocery) |
| `location` | `6499ba0478f0258111803da0` — on catalog, tRPC and GraphQL reads |

`/api/v2/user/loyalty/get-customer-card-list` additionally wants the same token
in a plain `authorization` header. The client handles that one automatically.

## Usage

```ts
import { HappierClient } from "happier-api";

const client = await HappierClient.signIn(email, password);

// Catalog — search is tRPC, with server-side semantic search
const { products } = await client.trpc.getAllProducts({
  searchQuery: "Sardines",
  useSemanticSearch: true,
  orderType: "PICKUP",
});

// Full product detail is GraphQL
const item = await client.graphql.productInventory(products[0]!._id);
console.log(item.product.name, item.price, item.inStock);

// Related products, merchandising groups
await client.products.related(item._id, 10);
await client.products.groupInventory("67cb037223ac2e96bef9b8ed");

// Fulfillment windows
const slots = await client.business.deliverySlots({
  cart: [{ productID: item.product._id, id: item._id, _id: item._id }],
});

// Checkout
const checkout = await client.checkout.create({
  businessLocation: client.http.locationId,
  orderType: "PICKUP",
  lineItems: [
    {
      id: item._id,
      _id: item._id,
      productID: item.product._id,
      productInventoryID: item._id,
      name: item.product.name,
      price: item.price,
      quantity: 1,
    },
  ],
});
await client.checkout.getShippingRates({
  address: { country: "US" },
  orderTotal: item.price,
  location: client.http.locationId,
});
await client.checkout.offers(checkout._id!);

// Account
await client.user.me();
await client.user.cards();
await client.loyalty.cards();
await client.loyalty.profile(); // points, tier, vouchers

// Orders
await client.orders.countSince(new Date(Date.now() - 30 * 864e5));
const { orders, totalResults } = await client.orders.list(); // history, newest first
const order = await client.orders.get(orders[0]?._id ?? "9eb8a23bc44ee8a4b3ad60aa");
order.lineItems.map((li) => `${li.quantity}x ${li.itemName}`);
new Date(Number(order.datePlaced)); // epoch-millis string, not ISO
if ("jobConfigurations" in order.deliveryDetails!) {
  order.deliveryDetails.jobConfigurations[0]?.publicTrackingUrl; // Nash tracker
}
const { payments, refunds } = await client.orders.detail(order._id); // order + payments + refunds + delivery

// Catalog structure
const { categories } = await client.trpc.getCategoriesWithProducts();
await client.trpc.getSubCategories({ category: "PRODUCE" });
```

### Escape hatches

Nothing is sealed. Unmapped routes and procedures are one call away:

```ts
await client.http.request("api/v2/some/new/route", { query: { foo: 1 } });
await client.trpc.query("products.getSubCategories", { category: "PANTRY" });
await client.graphql.request(MY_QUERY, { id }, { operationName: "MyQuery" });
```

## API surface

Three protocols behind one host and one auth contract:

**REST** — `client.business` (settings, delivery slots), `client.products`
(related, group inventory), `client.checkout` (create, taxes, shipping rates,
offers), `client.orders` (list, get, detail, delivery details, refunds, payments, count),
`client.user` (me, addresses, cards, Stripe setup intent), `client.loyalty`
(cards, profile), `client.analytics` (auth/cart/catalog events).

**GraphQL** (`POST /graphql`) — `ProductInventory`, `GetOrderById`, `GetOrders`.

**tRPC** (`GET /trpc/…?batch=1`) — `products.getAll`, `products.getFilters`,
`products.getSubCategories`, `products.getCategoriesWithProducts`,
`orders.getUserOrderCount`. Real batching is supported:

```ts
const [filters, results] = await client.trpc.batch([
  { procedure: "products.getFilters", input: { searchQuery: "Sardines" } },
  { procedure: "products.getAll", input: { searchQuery: "Sardines", orderType: "PICKUP" } },
]);
```

## OpenAPI

[`openapi.yaml`](./openapi.yaml) is a hand-curated OpenAPI 3.1 spec for the same
surface — parameterized paths, a documented `vendoraAuth` security scheme, and no
captured tokens baked in. Feed it to `openapi-typescript`, Swagger UI, Postman,
or a generator in another language.

## Errors

`HappierApiError` (non-2xx, with `.status`/`.body`), `HappierAuthError`
(`.code` is Firebase's string, e.g. `INVALID_LOGIN_CREDENTIALS`,
`TOO_MANY_ATTEMPTS_TRY_LATER`), `HappierTrpcError`, `HappierGraphQLError`. All
extend `HappierError`.

## Caveats

- `/api/v2/user/me`, `/api/v2/user/address` and `/api/v2/order/delivery-details`
  only ever returned `304 Not Modified` in the captures, so their response shapes
  are typed as open records. Everything else is typed from an observed body.
- `orders.list` (`GetOrders`) was not in the app capture; it was found on the
  GraphQL schema. Its `OrderQueryParams` argument (`sort`, `sortDirection`,
  `page`, `numResults`) was mapped from validation errors, and the resolver
  requires `sort`, so the client always sends `datePlaced desc` unless you
  override it. Pagination is untested beyond a single page.
- `Order.orderType` (`local` / `inStore`) is a different vocabulary from the
  checkout `OrderType` (`PICKUP` / `DELIVERY` / `SHIPPING`), and `datePlaced` /
  `dueDate` are millisecond-epoch strings.
- Payment flows are partial: the client can create checkouts, quote taxes and
  rates, and mint a Stripe SetupIntent, but order *placement* was not captured.
- The capture is one session from one store. Other locations or businesses may
  expose fields this misses.
