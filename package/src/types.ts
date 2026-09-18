/**
 * Types for the Happier Grocery API.
 *
 * These were derived from Proxyman captures of the iOS app
 * (`Happier/1 CFNetwork/3896.100.1.2.1 Darwin/27.0.0`). Endpoints that only ever
 * returned `304 Not Modified` during the captures are typed loosely and marked.
 */

/** Mongo ObjectId rendered as a 24-char hex string. */
export type ObjectId = string;

/** Fulfillment method as requested at checkout / catalog time. */
export type OrderType = "PICKUP" | "DELIVERY" | "SHIPPING";

/** Nearly every REST response is wrapped in `{ status: true, ...payload }`. */
export interface StatusEnvelope {
  status: boolean;
  message?: string;
}

export interface ProductImage {
  src: string;
  license?: string | null;
  origin?: string | null;
  blurhash?: string | null;
}

export interface Product {
  _id: ObjectId;
  name: string;
  description?: string;
  price: number;
  compareAt?: number;
  brand?: string;
  category?: string;
  subCategory?: string;
  size?: number | string;
  unitOfMeasure?: string;
  images?: ProductImage[];
  tags?: string[];
  attributes?: string[];
  SKU?: string;
  PLU?: string;
  upcBarcode?: string;
  eanBarcode?: string;
  externalIdentifier?: string;
  business?: ObjectId;
  active?: boolean;
  taxable?: boolean;
  ebtEligible?: boolean;
  wicEligible?: boolean;
  containsAlcohol?: boolean;
  soldByWeight?: boolean;
  isRandomWeight?: boolean;
  itemRequiresShippingInfo?: boolean;
  allowsPickup?: boolean;
  allowsDelivery?: boolean;
  allowsShipping?: boolean;
  productType?: string;
  ingredients?: string;
  [key: string]: unknown;
}

/** A product as stocked at a specific location — this is what you add to a cart. */
export interface ProductInventory {
  _id: ObjectId;
  id?: ObjectId;
  product: Product;
  location?: ObjectId;
  price: number;
  active?: boolean;
  inStock?: boolean;
  inStockQuantity?: number;
  discount?: {
    hasDiscount: boolean;
    discountedPrice?: number;
    labels?: string[];
  };
  modifierGroups?: ModifierGroup[];
  [key: string]: unknown;
}

export interface ModifierGroup {
  _id: ObjectId;
  id?: string;
  name?: string;
  displayOrder?: number;
  answerRequired?: boolean;
  type?: string;
  inventory?: ProductInventory[];
  [key: string]: unknown;
}

/** A catalog category (`products.getCategoriesWithProducts`). */
export interface ProductCategory {
  _id: ObjectId;
  name: string;
  /** Stable code used as `category` in searches, e.g. `"DAIRY"`, `"PANTRY"`. */
  identifier: string;
  business?: ObjectId;
  department?: string;
  order?: number;
  active?: boolean;
  allowsPickup?: boolean;
  allowsDelivery?: boolean;
  allowsShipping?: boolean;
  showInWhiteLabelStore?: boolean;
  isBeverageBar?: boolean;
  banner?: string | null;
  icon?: string | null;
  [key: string]: unknown;
}

/** A sub-category (`products.getSubCategories`). */
export interface ProductSubCategory {
  _id: ObjectId;
  /** Parent category `_id`. */
  category: ObjectId;
  name: string;
  /** Stable code used as `subCategory` in searches, e.g. `"FRCOFFEE"`. */
  identifier: string;
  active: boolean;
  [key: string]: unknown;
}

export interface BusinessSettingsResponse extends StatusEnvelope {
  settings: {
    _id: ObjectId;
    business: ObjectId;
    theme?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface RelatedProductsResponse extends StatusEnvelope {
  relatedProducts: ProductInventory[];
}

export interface ProductGroupInventoryResponse extends StatusEnvelope {
  productGroup: {
    _id: ObjectId;
    name: string;
    business: ObjectId;
    products: ProductInventory[];
    [key: string]: unknown;
  };
}

export interface DeliverySlotDay {
  friendlyDate: string;
  dayName: string;
  dayNameShort: string;
  monthName: string;
  numberDay: string;
  numberWithoutSuffix: string;
  /** e.g. `"01:00 PM - 03:00 PM"` */
  timeSlots: string[];
  beginningOfSlot: string;
}

export interface DeliverySlotsResponse extends StatusEnvelope {
  todaysHours: { openToday: boolean; openTime: string; closeTime: string };
  deliveryEnabled: boolean;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  asapDeliveryEnabled: boolean;
  asapPickupEnabled: boolean;
  /** Minutes of lead time added to ASAP orders. */
  asapDeliveryOrderPadding: number;
  asapPickupOrderPadding: number;
  scheduledDeliveryEnabled: boolean;
  scheduledPickupEnabled: boolean;
  replacementEnabled: boolean;
  deliverySlots: DeliverySlotDay[];
  [key: string]: unknown;
}

/** Minimal cart shape accepted by `POST /api/v1/business/location/deliverySlots`. */
export interface DeliverySlotsCartItem {
  productID: ObjectId;
  id: ObjectId;
  _id: ObjectId;
}

export interface LineItem {
  /** Product **inventory** id — same value as `productInventoryID`. */
  id: ObjectId;
  _id: ObjectId;
  productID: ObjectId;
  productInventoryID: ObjectId;
  name: string;
  price: number;
  quantity: number;
  itemTotal?: number;
  images?: ProductImage[];
  modifiers?: unknown[];
  size?: string;
  unitOfMeasure?: string;
  brand?: string;
  category?: string;
  subCategory?: string;
  taxable?: boolean;
  ebtEligible?: boolean;
  containsAlcohol?: boolean;
  [key: string]: unknown;
}

export interface Address {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface CreateCheckoutRequest {
  businessLocation: ObjectId;
  lineItems: LineItem[];
  orderType?: OrderType;
  [key: string]: unknown;
}

export interface Checkout {
  _id?: ObjectId;
  business: ObjectId;
  location: ObjectId;
  sessionID?: string;
  status: string;
  orderType: OrderType;
  tip: number;
  lineItems: LineItem[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GetTaxesRequest {
  checkoutID: ObjectId;
  shippingAddress: Address;
  contactInfo: { email: string; phone: string };
}

export interface GetTaxesResponse extends StatusEnvelope {
  taxRequired: number;
}

export interface ShippingRate {
  id: ObjectId;
  name: string;
  amount: number;
  orderType: OrderType;
}

export interface GetShippingRatesRequest {
  address: Address;
  orderTotal: number;
  location: ObjectId;
}

export interface GetShippingRatesResponse extends StatusEnvelope {
  shippingRates: ShippingRate[];
}

export interface CheckoutOffersResponse extends StatusEnvelope {
  data: {
    bottleDepositAmount: number;
    numBottleDeposits: number;
    snapEligibleAmount: number;
    snapEligibleItems: unknown[];
    coupons: unknown[];
    couponData: Record<string, unknown>;
    allCoupons: LoyaltyCoupon[];
    [key: string]: unknown;
  };
}

export interface LoyaltyCoupon {
  id: number;
  name: string;
  type: string;
  worth: string;
  description?: string;
  expiryDate?: string | null;
  image?: string;
  minimumBillAmount?: number;
  voucherType?: string;
  value?: string;
  [key: string]: unknown;
}

export interface LoyaltyCard {
  id: number;
  uid: number;
  name: string;
  slug: string;
  type: string;
  isBaseCard: boolean;
  expiry: number;
  pointsRate: string;
  currencyConversionRate: string;
  worth: number;
  color?: string;
  textColor?: string;
  backgroundColor?: string;
  nextCardId?: number | null;
  plusCardId?: number | null;
  taxes?: Array<{ name: string; value: number; [k: string]: unknown }>;
  [key: string]: unknown;
}

export interface LoyaltyCardListResponse extends StatusEnvelope {
  cards: LoyaltyCard[];
}

export interface PaymentMethodsResponse {
  paymentMethods: unknown[];
  foragePaymentMethods: unknown[];
}

/** Stripe SetupIntent client secret, for attaching a new card. */
export interface SetupIntentResponse {
  client_secret: string;
}

export interface Payment {
  _id: ObjectId;
  checkout: ObjectId;
  business: ObjectId;
  location: ObjectId;
  /** `STRIPE` for app orders, `DATA_CAP` for in-store card terminal sales. */
  paymentType: PaymentType;
  amount: number;
  status: PaymentStatus;
  /** Pre-auth amount for weighed/substitutable carts; `amount` is what settled. */
  authorizedAmount?: number;
  refundStatus?: string;
  amountRefunded?: number;
  testMode?: boolean;
  isSafDecline?: boolean;
  /** Stripe PaymentIntent id, or the terminal's invoice number for `DATA_CAP`. */
  externalServiceID?: string;
  /** POS terminal id — in-store payments only. */
  device?: ObjectId;
  shift?: ObjectId | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type PaymentType = "STRIPE" | "DATA_CAP" | "FORAGE" | (string & {});
export type PaymentStatus = "paid" | "authorized" | "refunded" | "failed" | (string & {});

export interface OrderPaymentsResponse extends StatusEnvelope {
  payments: Payment[];
}

export interface OrderRefundsResponse extends StatusEnvelope {
  /** Never observed non-empty. */
  refunds: unknown[];
}

/**
 * `GET /api/v2/order/delivery-details` only ever answered `304` in the captures,
 * so its body is untyped. A dispatch-time snapshot of the same Nash job arrives
 * inline as `Order.deliveryDetails` — see {@link DeliveryJob}.
 */
export type OrderDeliveryDetailsResponse = Record<string, unknown>;

/**
 * How an order was fulfilled, as stored on the order. Note this is a different
 * vocabulary from {@link OrderType}: `local` is app delivery, `inStore` is a POS
 * sale.
 */
export type OrderChannel = "local" | "inStore" | "pickup" | "shipping" | (string & {});

/** `created` means accepted and being worked; `fulfilled` is terminal. */
export type OrderStatus = "created" | "fulfilled" | "cancelled" | "refunded" | (string & {});

export type OrderPickingStatus = "PENDING" | "IN_PROGRESS" | "DONE" | (string & {});

/** Where the order originated. */
export type OrderPlatform =
  | "vendora_split_tender"
  | "vendora_pos"
  | "vendora"
  | (string & {});

/**
 * A line on a placed order. Two dialects show up: app orders carry `name`
 * and `cartID`, POS orders carry `itemName` and tax breakdowns. Both carry
 * `itemName`; prefer it.
 */
export interface OrderLineItem {
  id: ObjectId;
  _id: ObjectId;
  productID: ObjectId;
  /** Duplicate of `productID` on app orders. */
  productId?: ObjectId;
  productInventoryID: ObjectId;
  itemName: string;
  name?: string;
  /** Unit price charged. */
  price: number;
  /** Shelf price before member/TPR discounts. */
  originalPrice?: number;
  /** Price shown in the app at add-to-cart time. */
  customerSeenPrice?: number;
  cost?: number;
  /** Fulfilled quantity — fractional for weighed items. */
  quantity: number;
  /** Quantity the customer asked for, before picking. */
  requestedQty?: number;
  itemTotal?: number;
  images?: Array<ProductImage | string>;
  modifiers?: unknown[];
  size?: number | string;
  unitOfMeasure?: string;
  caseSize?: number;
  brand?: string;
  category?: string;
  subCategory?: string;
  SKU?: string;
  barcode?: string;
  upcBarcode?: string;
  taxable?: boolean;
  ebtEligible?: boolean;
  soldByWeight?: boolean;
  containsAlcohol?: boolean;
  containsTobacco?: boolean;
  containsCBD?: boolean;
  requiresBottleDeposit?: boolean;
  manualPrice?: boolean;
  isNonSalesItem?: boolean;
  /** Whether the shopper allowed substitution. */
  substitute?: boolean | null;
  /** What the picker swapped in, when the item was substituted. */
  substitutedBy?: OrderSubstitution | null;
  comment?: string | null;
  cartID?: ObjectId;
  variantAttributes?: Record<string, unknown>;
  taxes?: unknown[];
  taxesCharged?: number;
  taxesExempted?: number;
  /** Full catalog record, denormalized at order time. */
  product?: Product;
  [key: string]: unknown;
}

export interface OrderSubstitution {
  productID: ObjectId;
  itemName: string;
  price: number;
  quantity: number;
  SKU?: string;
  upcBarcode?: string;
  images?: ProductImage[];
  cartID?: ObjectId;
  [key: string]: unknown;
}

/** Contact + drop-off details captured at checkout. */
export interface OrderShippingAddress extends Address {
  phoneNumber?: string;
  /** Rate chosen at checkout, e.g. `"Delivery"`. */
  selectedRate?: string;
  /** Human-readable slot, e.g. `"ASAP (1.5 hours)"`. */
  timeslotText?: string;
  /** POS orders record the shopper's balance here instead of an address. */
  loyaltyPointsBalance?: number;
  [key: string]: unknown;
}

/** A promotion (TPR = temporary price reduction) applied to an order. */
export interface OrderDiscount {
  platform: string;
  uses: number;
  useID: string;
  discountType: "tpr" | "coupon" | (string & {});
  discount: {
    _id: ObjectId;
    name: string;
    active?: boolean;
    tprType?: "AMOUNT_OFF_PRODUCT" | (string & {});
    valueType?: "PERCENT" | "AMOUNT" | (string & {});
    amount?: number;
    minQuantity?: number;
    maxQuantity?: number;
    startDate?: string;
    endDate?: string;
    rules?: {
      products?: ObjectId[];
      departments?: string[];
      categories?: string[];
      subCategories?: string[];
      productTags?: string[];
      productBrands?: string[];
      customerGroups?: string[];
    };
    [key: string]: unknown;
  };
  applications: Array<{
    cartItem: {
      id: ObjectId;
      _id: ObjectId;
      productID: ObjectId;
      price: number;
      quantity: number;
      itemTotal?: number;
      originalPrice?: number;
      discountedPrice?: number;
      [key: string]: unknown;
    };
    originalPrice: number;
    discountedPrice: number;
    discountType: string;
  }>;
}

/** Picker progress per line, keyed by the line's `cartID`. */
export interface OrderPickingInfo {
  lineItemProductId: ObjectId;
  cartID: ObjectId;
  pickedQty: number;
  notFoundQty: number;
}

export interface OrderLocationInfo {
  name: string;
  address: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  latitude?: string;
  longitude?: string;
}

/** A geocoded stop in a Nash delivery job. */
export interface DeliveryLocation {
  id: string;
  address: string;
  formattedAddress?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  timezoneId?: string;
  instructions?: string | null;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  email?: string | null;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

/**
 * Live courier state for a delivery. `status` moves through Nash's vocabulary
 * (`NOT_ASSIGNED_DRIVER`, `ASSIGNED_DRIVER`, `PICKUP_ENROUTE`, `PICKUP_COMPLETE`,
 * `DROPOFF_ENROUTE`, `DROPOFF_COMPLETE`, …).
 */
export interface CourierDelivery {
  id: string;
  type?: string;
  status: string;
  statusHistory?: Array<{ createdAt: string; status: string; [key: string]: unknown }>;
  isActive?: boolean;
  pickupEta?: string | null;
  dropoffEta?: string | null;
  dropoffDeadline?: string | null;
  priceCents?: number;
  totalPriceCents?: number;
  currency?: string;
  courierName?: string | null;
  courierPhoneNumber?: string | null;
  courierLocation?: { lat: number; lng: number; [key: string]: unknown } | null;
  courierVehicle?: Record<string, unknown> | null;
  courierProfileImage?: string | null;
  proofOfDelivery?: unknown;
  providerDeliveryId?: string | null;
  [key: string]: unknown;
}

export interface DeliveryTask {
  id: string;
  createdAt: string;
  status: string;
  pickupStartTime?: string;
  pickupEndTime?: string;
  dropoffStartTime?: string;
  dropoffEndTime?: string;
  /** e.g. `"uber_grocery_partner"` */
  providerId?: string | null;
  tipAmountCents?: number;
  winnerQuote?: {
    id: string;
    providerId: string;
    providerName: string;
    [key: string]: unknown;
  } | null;
  delivery?: CourierDelivery | null;
  failureCode?: string | null;
  failureReason?: string | null;
  [key: string]: unknown;
}

export interface DeliveryJobConfiguration {
  id: string;
  package: {
    id: string;
    description?: string;
    requirements?: string[];
    packageDeliveryMode?: "SCHEDULED" | "NOW" | (string & {});
    pickupStartTime?: string;
    pickupEndTime?: string;
    dropoffStartTime?: string;
    dropoffEndTime?: string;
    valueCents?: number;
    itemsCount?: number;
    pickupLocation: DeliveryLocation;
    dropoffLocation: DeliveryLocation;
    drivingMetrics?: { distance: number; duration: number };
    [key: string]: unknown;
  };
  tasks?: DeliveryTask[];
  /** The task Nash is currently running for this job. */
  advancedTask?: DeliveryTask | null;
  /** Customer-facing tracking page on `tracking.usenash.com`. */
  publicTrackingUrl?: string;
  [key: string]: unknown;
}

/**
 * Happier dispatches deliveries through Nash (`usenash.com`); this is the Nash
 * job as embedded in `Order.deliveryDetails`. Empty (`{}`) for pickup and POS
 * orders.
 *
 * In the captures the job-level `status` was current (`dropoff_complete`) while
 * the nested task/courier state still read `RUNNING` / `NOT_ASSIGNED_DRIVER` —
 * treat everything below `jobConfigurations` as a dispatch-time snapshot and use
 * `publicTrackingUrl` (or `client.orders.deliveryDetails`) for live tracking.
 */
export interface DeliveryJob {
  id: string;
  createdAt: string;
  /** Job-level status, e.g. `"created"`, `"dropoff_complete"`. */
  status: string;
  isActive?: boolean;
  isBatch?: boolean;
  portalUrl?: string;
  externalIdentifier?: string | null;
  jobMetadata?: Record<string, unknown>;
  jobConfigurations: DeliveryJobConfiguration[];
  optionsGroup?: Record<string, unknown>;
  route?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/**
 * A placed order, as returned by the `GetOrderById` GraphQL query.
 *
 * Timestamps (`datePlaced`, `dueDate`) are **millisecond epoch strings**, not
 * ISO — `new Date(Number(order.datePlaced))`.
 */
export interface Order {
  _id: ObjectId;
  /** Short sequential number for app orders (`"15889"`); long for POS receipts. */
  orderNumber: string;
  /** The checkout this order was created from. */
  externalID?: string;
  business: ObjectId;
  location: ObjectId;
  /** Owning user's id. */
  uid: string;
  platform?: OrderPlatform;
  status: OrderStatus;
  internalStatus?: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus?: string;
  internalFulfillmentStatus?: string;
  pickingStatus?: OrderPickingStatus;
  pickingInfo?: OrderPickingInfo[];
  orderType: OrderChannel;
  /** e.g. `["DELIVERY"]` */
  attributes?: string[];
  /** Millisecond epoch as a string. */
  datePlaced: string;
  /** Millisecond epoch as a string. */
  dueDate?: string;
  dueASAP?: boolean;
  /** Sum of quantities — fractional when weighed items are present. */
  numItems?: number;
  lineItems: OrderLineItem[];
  discounts?: OrderDiscount[];
  note?: string;
  currency?: string | null;
  totalPrice: number;
  totalShipping?: number;
  totalTax?: number;
  totalTip?: number;
  shippingAddress?: OrderShippingAddress;
  shipmentInfo?: unknown[];
  /** Nash delivery job. `{}` when the order was not delivered. */
  deliveryDetails?: DeliveryJob | Record<string, never>;
  clientDetails?: { os?: string; appVersion?: string; [key: string]: unknown } | null;
  testOrder?: boolean;
  twillioConversationID?: string | null;
  locationInfo?: OrderLocationInfo;
  loyalty?: { isLoyaltyTransaction: boolean; points: number };
  [key: string]: unknown;
}

/** `Query.getOrders` — the signed-in user's orders plus pagination totals. */
export interface OrdersPage {
  orders: Order[];
  totalPages: number;
  totalResults: number;
}

/** Everything the app's order screen loads, in one object. */
export interface OrderDetail {
  order: Order;
  payments: Payment[];
  refunds: unknown[];
  deliveryDetails: OrderDeliveryDetailsResponse;
}

/**
 * Only observed as `304 Not Modified` in the capture, so the body shape is
 * unverified. Treated as an open record.
 */
export type CurrentUser = Record<string, unknown>;
/** @see CurrentUser — also only observed as 304. */
export type UserAddressesResponse = Record<string, unknown>;

/** A voucher or freebie attached to a loyalty account (Froogal). */
export interface LoyaltyBenefit {
  platform: "FROOGAL" | (string & {});
  benefitData: LoyaltyCoupon & {
    isPaid?: boolean;
    items?: unknown[];
    categories?: string[];
    validOutlets?: string[];
    /** Seven flags, Monday-first, e.g. `"1111111"`. */
    validDays?: string;
    reusable?: boolean;
    canBuy?: boolean;
    terms?: string | null;
    about?: string | null;
    /** The redeemable instance, when one has been issued. */
    freebieItem?: {
      id: number | null;
      status: string | null;
      isLive: boolean | null;
      qrCode: string | null;
      couponCode: string | null;
      redeemedAt: string | null;
      expiryDate: string | null;
      [key: string]: unknown;
    };
  };
}

export interface LoyaltyProfile {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  loyaltyAccount: {
    pointsBalance: number;
    platformSpecificData: {
      loyaltyId?: number;
      userId?: number;
      membershipCardNumber?: string;
      visits?: number;
      /** Lifetime spend, abbreviated (`"11K"`). */
      spending?: string;
      currentYearSpending?: string;
      points?: number;
      pointsOnHold?: number;
      pointsOnHoldReleaseAt?: string | null;
      /** Matches `LoyaltyCard.id`. */
      currentCardId?: number;
      currentCardSlug?: string;
      /** Membership expiry, `YYYY-MM-DD`. */
      expiry?: string;
      isPaid?: boolean;
      autoRenews?: number;
      status?: string;
      isMember?: boolean;
      isEnrolled?: boolean;
      isBlocked?: boolean;
      enrolledPrograms?: number[];
      pointsEarned?: number;
      pointsRedeemed?: number;
      /** Points per currency unit, as a string (`"10.00"`). */
      currencyConversionRate?: string;
      [key: string]: unknown;
    };
  };
  /** `uid` matches `LoyaltyCard.uid`; a point is worth `pointsRedemptionValue` dollars. */
  loyaltyTier?: { uid: number; pointsRedemptionValue: number };
  /** Vouchers already on the account. */
  loyaltyBenefits?: LoyaltyBenefit[];
  /** Vouchers the user can claim / that are live this period. */
  availableBenefits?: LoyaltyBenefit[];
  platform?: "FROOGAL" | (string & {});
  accountStatus?: "ACTIVE" | (string & {});
  customerGroups?: Array<{
    id: number;
    customerGroupPublicId: string;
    name: string;
    description?: string;
    groupType?: string;
    groupData?: Record<string, unknown>;
    status?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface LoyaltyProfileResponse extends StatusEnvelope {
  data: LoyaltyProfile;
}

export type AuthEventName = "auth:sign_in" | (string & {});
export type CartEventName = "cart:item_added" | (string & {});
export type CatalogEventName = "catalog:product_viewed" | (string & {});

export interface AnalyticsEvent<N extends string = string> {
  eventName: N;
  properties: Record<string, unknown> & { platform?: "mobile" | "web" | (string & {}) };
}
