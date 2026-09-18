import { FirebaseAuth, signInWithEmailAndPassword, type AuthConfig } from "./auth.js";
import { GraphQLApi } from "./graphql.js";
import { HappierHttp, type ClientConfig } from "./http.js";
import { TrpcApi } from "./trpc.js";
import type {
  Address,
  AnalyticsEvent,
  AuthEventName,
  BusinessSettingsResponse,
  CartEventName,
  CatalogEventName,
  Checkout,
  CheckoutOffersResponse,
  CreateCheckoutRequest,
  CurrentUser,
  DeliverySlotsCartItem,
  DeliverySlotsResponse,
  GetShippingRatesRequest,
  GetShippingRatesResponse,
  GetTaxesRequest,
  GetTaxesResponse,
  LoyaltyCardListResponse,
  LoyaltyProfileResponse,
  ObjectId,
  Order,
  OrderDeliveryDetailsResponse,
  OrderDetail,
  OrderPaymentsResponse,
  OrderRefundsResponse,
  OrderType,
  PaymentMethodsResponse,
  ProductGroupInventoryResponse,
  RelatedProductsResponse,
  SetupIntentResponse,
  UserAddressesResponse,
} from "./types.js";

/**
 * Client for the Happier Grocery commerce API.
 *
 * Three surfaces share one host and one auth contract:
 * REST under `/api/v{1,2,3}`, GraphQL at `/graphql`, and tRPC at `/trpc`.
 *
 * @example
 * const client = await HappierClient.signIn(email, password);
 * const me = await client.user.me();
 */
export class HappierClient {
  readonly http: HappierHttp;
  readonly graphql: GraphQLApi;
  readonly trpc: TrpcApi;

  readonly business: BusinessResource;
  readonly products: ProductsResource;
  readonly checkout: CheckoutResource;
  readonly orders: OrdersResource;
  readonly user: UserResource;
  readonly loyalty: LoyaltyResource;
  readonly analytics: AnalyticsResource;

  constructor(config: ClientConfig = {}) {
    this.http = new HappierHttp(config);
    this.graphql = new GraphQLApi(this.http);
    this.trpc = new TrpcApi(this.http);

    this.business = new BusinessResource(this.http);
    this.products = new ProductsResource(this.http);
    this.checkout = new CheckoutResource(this.http);
    this.orders = new OrdersResource(this.http, this.graphql, this.trpc);
    this.user = new UserResource(this.http);
    this.loyalty = new LoyaltyResource(this.http);
    this.analytics = new AnalyticsResource(this.http);
  }

  /**
   * Sign in and return a ready client. Tokens refresh automatically.
   *
   * @see {@link signInWithEmailAndPassword} for the raw auth call.
   */
  static async signIn(
    email: string,
    password: string,
    config: AuthConfig & Omit<ClientConfig, "auth" | "idToken"> = {},
  ): Promise<HappierClient> {
    const auth = new FirebaseAuth(config);
    await auth.signIn(email, password);
    return new HappierClient({ ...config, auth });
  }

  /** Build a client from a persisted refresh token — no password needed. */
  static fromRefreshToken(
    refreshToken: string,
    config: AuthConfig & Omit<ClientConfig, "auth" | "idToken"> = {},
  ): HappierClient {
    return new HappierClient({ ...config, auth: FirebaseAuth.fromRefreshToken(refreshToken, config) });
  }

  /** The signed-in session, if this client owns one. */
  get session() {
    return this.http.auth?.session ?? null;
  }
}

class BusinessResource {
  constructor(private readonly http: HappierHttp) {}

  /** Storefront configuration: theme, feature flags, locations. Unauthenticated. */
  settings(businessID = this.http.businessId): Promise<BusinessSettingsResponse> {
    return this.http.request("api/v1/business/settings", {
      query: { businessID },
      anonymous: true,
    });
  }

  /**
   * Fulfillment windows for a location, validated against a cart.
   *
   * `validateOffCart: true` makes the server check the cart's items against each
   * slot (the app always sends it).
   */
  deliverySlots(
    args: {
      businessLocationID?: ObjectId;
      cart?: DeliverySlotsCartItem[];
      validateOffCart?: boolean;
    } = {},
  ): Promise<DeliverySlotsResponse> {
    return this.http.request("api/v1/business/location/deliverySlots", {
      method: "POST",
      query: {
        businessLocationID: args.businessLocationID ?? this.http.locationId,
        validateOffCart: args.validateOffCart ?? true,
      },
      body: { cart: args.cart ?? [] },
    });
  }
}

class ProductsResource {
  constructor(private readonly http: HappierHttp) {}

  /** "You might also like" for a product **inventory** id. */
  related(productID: ObjectId, numResults = 10): Promise<RelatedProductsResponse> {
    return this.http.request("api/v1/products/related", {
      query: { productID, numResults },
    });
  }

  /** Every product in a merchandising group (e.g. "Happier Beverages"). */
  groupInventory(
    groupId: ObjectId,
    orderType: OrderType = "PICKUP",
  ): Promise<ProductGroupInventoryResponse> {
    return this.http.request(`api/v3/public/products/groups/${groupId}/inventory`, {
      query: { orderType },
      sendLocation: true,
    });
  }
}

class CheckoutResource {
  constructor(private readonly http: HappierHttp) {}

  /** Create a checkout session from a cart. */
  create(body: CreateCheckoutRequest): Promise<Checkout> {
    return this.http.request("api/v2/checkouts", { method: "POST", body });
  }

  /** Tax due for a checkout, given the shipping address and contact info. */
  getTaxes(body: GetTaxesRequest): Promise<GetTaxesResponse> {
    return this.http.request("api/v2/checkouts/get-taxes", { method: "POST", body });
  }

  /** Available fulfillment rates — pickup shows up here as a $0 rate. */
  getShippingRates(
    body: GetShippingRatesRequest,
    orderType: OrderType = "PICKUP",
  ): Promise<GetShippingRatesResponse> {
    return this.http.request("api/v2/shipping/get-rates", {
      method: "POST",
      query: { orderType },
      body,
    });
  }

  /** Coupons, SNAP eligibility and bottle deposits applicable to a checkout. */
  offers(checkoutID: ObjectId): Promise<CheckoutOffersResponse> {
    return this.http.request("api/v3/checkout/offers", { query: { checkoutID } });
  }
}

class OrdersResource {
  constructor(
    private readonly http: HappierHttp,
    private readonly graphql: GraphQLApi,
    private readonly trpc: TrpcApi,
  ) {}

  /**
   * Full order detail, via GraphQL — the only route that returns line items.
   *
   * Covers app orders and in-store POS receipts alike (`order.orderType` tells
   * them apart). Delivery tracking, when present, is inline at
   * `order.deliveryDetails`.
   */
  get(orderId: ObjectId): Promise<Order> {
    return this.graphql.getOrderById(orderId);
  }

  /**
   * Everything the app's order screen fetches, in parallel: the order plus its
   * payments, refunds and delivery details.
   */
  async detail(orderId: ObjectId): Promise<OrderDetail> {
    const [order, payments, refunds, deliveryDetails] = await Promise.all([
      this.get(orderId),
      this.payments(orderId),
      this.refunds(orderId),
      this.deliveryDetails(orderId),
    ]);
    return {
      order,
      payments: payments.payments,
      refunds: refunds.refunds,
      deliveryDetails,
    };
  }

  /**
   * Live courier tracking for a delivery order. Only ever observed as `304`, so
   * the body is untyped; `Order.deliveryDetails` from {@link get} carries a
   * typed dispatch-time snapshot of the same Nash job.
   */
  deliveryDetails(orderId: ObjectId): Promise<OrderDeliveryDetailsResponse> {
    return this.http.request("api/v2/order/delivery-details", { query: { orderId } });
  }

  /** Refunds issued against an order. */
  refunds(orderId: ObjectId): Promise<OrderRefundsResponse> {
    return this.http.request("api/v2/order/refunds", { query: { orderId } });
  }

  /** Payment records (Stripe, or the POS terminal for in-store orders). */
  payments(orderId: ObjectId): Promise<OrderPaymentsResponse> {
    return this.http.request("api/v2/orders/payments", { query: { orderId } });
  }

  /**
   * Number of orders placed since `fromDate`. Backed by tRPC.
   *
   * The app calls this with "30 days ago" on the home screen to decide whether
   * to show the reorder shelf.
   */
  countSince(fromDate: Date | string): Promise<number> {
    const iso = typeof fromDate === "string" ? fromDate : fromDate.toISOString();
    return this.trpc.getUserOrderCount({ fromDate: iso });
  }
}

class UserResource {
  constructor(private readonly http: HappierHttp) {}

  /** The signed-in user's profile. */
  me(): Promise<CurrentUser> {
    return this.http.request("api/v2/user/me");
  }

  addresses(): Promise<UserAddressesResponse> {
    return this.http.request("api/v2/user/address");
  }

  /** Saved Stripe payment methods, plus Forage (EBT/SNAP) methods. */
  cards(): Promise<PaymentMethodsResponse> {
    return this.http.request("api/v2/user/cards");
  }

  /**
   * A Stripe SetupIntent client secret for attaching a new card.
   * Confirm it with Stripe's SDK — Happier never sees the card number.
   */
  cardSetupIntent(): Promise<SetupIntentResponse> {
    return this.http.request("api/v2/user/cards/setup-intent");
  }
}

class LoyaltyResource {
  constructor(private readonly http: HappierHttp) {}

  /** Loyalty tiers ("Happier Green", "Happier Black"). */
  cards(): Promise<LoyaltyCardListResponse> {
    // The only route observed requiring the token in `authorization` as well.
    return this.http.request("api/v2/user/loyalty/get-customer-card-list", {
      mirrorAuthorization: true,
    });
  }

  /** The user's loyalty standing: points, tier, spend. */
  profile(): Promise<LoyaltyProfileResponse> {
    return this.http.request("api/v3/user/loyalty/profile");
  }
}

class AnalyticsResource {
  constructor(private readonly http: HappierHttp) {}

  /** Fire-and-forget telemetry. Responses carry no body. */
  auth(event: AnalyticsEvent<AuthEventName>): Promise<void> {
    return this.http.request("api/v1/analytics/auth-events", { method: "POST", body: event });
  }

  cart(event: AnalyticsEvent<CartEventName>): Promise<void> {
    return this.http.request("api/v1/analytics/cart-events", { method: "POST", body: event });
  }

  catalog(event: AnalyticsEvent<CatalogEventName>): Promise<void> {
    return this.http.request("api/v1/analytics/catalog-events", { method: "POST", body: event });
  }
}

export type { Address, ClientConfig };
