import { HappierGraphQLError } from "./errors.js";
import type { HappierHttp } from "./http.js";
import type { ObjectId, Order, OrderQueryParams, OrdersPage, ProductInventory } from "./types.js";

/** The two operations the app was observed issuing, verbatim. */
export const PRODUCT_INVENTORY_QUERY = /* GraphQL */ `
  query ProductInventory($productInventoryId: ID!) {
    productInventory(id: $productInventoryId) {
      _id
      active
      inStock
      inStockQuantity
      price
      discount {
        hasDiscount
        discountedPrice
        labels
      }
      product {
        _id
        name
        description
        ingredients
        brand
        category
        subCategory
        attributes
        tags
        price
        compareAt
        cost
        size
        caseSize
        unitOfMeasure
        SKU
        PLU
        Vendor
        VendorNumber
        upcBarcode
        active
        taxable
        ebtEligible
        containsAlcohol
        soldByWeight
        isRandomWeight
        itemRequiresShippingInfo
        productType
        baseRequiresVariant
        requiresBottleDeposit
        useExternalInventory
        images {
          license
          origin
          src
          blurhash
        }
        modifierGroups {
          _id
        }
      }
      modifierGroups {
        _id
        id
        name
        displayOrder
        answerRequired
        type
        inventory {
          _id
          price
          inStock
          inStockQuantity
          product {
            _id
            name
            price
            images {
              license
              origin
              src
              blurhash
            }
          }
        }
      }
      variants {
        _id
        price
        inStock
        inStockQuantity
        product {
          _id
          name
          price
          size
          unitOfMeasure
          caseSize
          brand
          taxable
          SKU
          ingredients
          requiresBottleDeposit
          productType
          baseRequiresVariant
          useExternalInventory
          variantAttributes {
            size
          }
          images {
            license
            origin
            src
            blurhash
          }
          modifierGroups {
            _id
          }
        }
      }
    }
  }
`;

const ORDER_FIELDS = /* GraphQL */ `
      _id
      orderNumber
      externalID
      business
      location
      uid
      platform
      status
      internalStatus
      paymentStatus
      fulfillmentStatus
      internalFulfillmentStatus
      pickingStatus
      pickingInfo
      orderType
      datePlaced
      dueDate
      dueASAP
      numItems
      lineItems
      attributes
      discounts
      note
      currency
      totalPrice
      totalShipping
      totalTax
      totalTip
      shippingAddress
      shipmentInfo
      deliveryDetails
      clientDetails
      testOrder
      twillioConversationID
      locationInfo {
        name
        address
        street2
        city
        state
        zip
        latitude
        longitude
      }
      loyalty {
        isLoyaltyTransaction
        points
      }
`;

export const GET_ORDER_BY_ID_QUERY = /* GraphQL */ `
  query GetOrderById($id: ID!) {
    getOrderById(id: $id) {${ORDER_FIELDS}    }
  }
`;

/**
 * Every order belonging to the signed-in user. Not observed in the app capture;
 * the field exists on the schema as
 * `Query.getOrders(queryParams: OrderQueryParams): OrdersResponse`. The
 * argument is nullable in the schema but the resolver destructures `sort` from
 * it, so an object must always be sent.
 */
export const GET_ORDERS_QUERY = /* GraphQL */ `
  query GetOrders($queryParams: OrderQueryParams) {
    getOrders(queryParams: $queryParams) {
      totalPages
      totalResults
      orders {${ORDER_FIELDS}      }
    }
  }
`;

export const DEFAULT_ORDER_QUERY_PARAMS: Readonly<OrderQueryParams> = {
  sort: "datePlaced",
  sortDirection: "desc",
};

/**
 * GraphQL surface at `POST /graphql`.
 *
 * Same auth contract as the REST routes: `x-vendora-authentication` plus the
 * `business` and `location` headers.
 */
export class GraphQLApi {
  readonly #http: HappierHttp;

  constructor(http: HappierHttp) {
    this.#http = http;
  }

  /** Execute an arbitrary operation and unwrap `data`, throwing on `errors`. */
  async request<T = unknown>(
    query: string,
    variables: Record<string, unknown> = {},
    options: { operationName?: string; signal?: AbortSignal } = {},
  ): Promise<T> {
    const operationName = options.operationName ?? query.match(/(?:query|mutation)\s+(\w+)/)?.[1];

    const res = await this.#http.request<{
      data?: T;
      errors?: Array<{ message: string; [k: string]: unknown }>;
    }>("graphql", {
      method: "POST",
      body: { operationName, variables, query },
      sendLocation: true,
      signal: options.signal,
    });

    if (res.errors?.length) throw new HappierGraphQLError(operationName ?? "anonymous", res.errors);
    return res.data as T;
  }

  /** Full product detail — this is what the app's product page loads. */
  async productInventory(productInventoryId: ObjectId): Promise<ProductInventory> {
    const data = await this.request<{ productInventory: ProductInventory }>(
      PRODUCT_INVENTORY_QUERY,
      { productInventoryId },
    );
    return data.productInventory;
  }

  /** A single order, including line items and delivery details. */
  async getOrderById(id: ObjectId): Promise<Order> {
    const data = await this.request<{ getOrderById: Order }>(GET_ORDER_BY_ID_QUERY, { id });
    return data.getOrderById;
  }

  /** The signed-in user's orders, with pagination totals. */
  async getOrders(queryParams: OrderQueryParams = {}): Promise<OrdersPage> {
    const data = await this.request<{ getOrders: OrdersPage }>(GET_ORDERS_QUERY, {
      queryParams: { ...DEFAULT_ORDER_QUERY_PARAMS, ...queryParams },
    });
    return data.getOrders;
  }
}
