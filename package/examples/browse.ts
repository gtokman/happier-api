/**
 * End-to-end smoke test: sign in, search, load a product, price a cart.
 *
 *   HAPPIER_EMAIL=you@example.com HAPPIER_PASSWORD=… bun run examples/browse.ts
 *
 * Nothing here places an order.
 */

import { HappierClient } from "../src/index.ts";

const email = process.env.HAPPIER_EMAIL;
const password = process.env.HAPPIER_PASSWORD;
if (!email || !password) {
  throw new Error("Set HAPPIER_EMAIL and HAPPIER_PASSWORD.");
}

const client = await HappierClient.signIn(email, password);
console.log(`signed in as ${client.session?.email} (${client.session?.uid})`);

const { products } = await client.trpc.getAllProducts({
  searchQuery: "Sardines",
  useSemanticSearch: true,
  orderType: "PICKUP",
});
console.log(`\n${products.length} results:`);
for (const p of products.slice(0, 5)) {
  console.log(`  ${p.product.name} — $${p.price}${p.inStock ? "" : " (out of stock)"}`);
}

const first = products[0];
if (!first) process.exit(0);

const detail = await client.graphql.productInventory(first._id);
console.log(`\n${detail.product.name}`);
console.log(`  brand:    ${detail.product.brand ?? "—"}`);
console.log(`  category: ${detail.product.category}/${detail.product.subCategory}`);
console.log(`  stock:    ${detail.inStockQuantity ?? "?"}`);

const slots = await client.business.deliverySlots({
  cart: [{ productID: detail.product._id, id: detail._id, _id: detail._id }],
});
console.log(
  `\npickup ${slots.pickupEnabled ? "on" : "off"}, delivery ${slots.deliveryEnabled ? "on" : "off"}` +
    `, ${slots.deliverySlots.length} days of slots`,
);

const rates = await client.checkout.getShippingRates({
  address: { country: "US" },
  orderTotal: detail.price,
  location: client.http.locationId,
});
console.log(`rates: ${rates.shippingRates.map((r) => `${r.name} $${r.amount}`).join(", ")}`);

const orders = await client.orders.countSince(new Date(Date.now() - 30 * 864e5));
console.log(`\norders in the last 30 days: ${orders}`);
