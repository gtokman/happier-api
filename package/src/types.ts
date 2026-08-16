/**
 * Types for the Happier Grocery API.
 *
 * These were derived from a Proxyman capture of the iOS app
 * (`Happier/1 CFNetwork/3896.100.1.2.1 Darwin/27.0.0`). Endpoints that only ever
 * returned `304 Not Modified` during the capture are typed loosely and marked.
 */

/** Mongo ObjectId rendered as a 24-char hex string. */
export type ObjectId = string;

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
  paymentType: string;
  amount: number;
  status: string;
  refundStatus?: string;
  amountRefunded?: number;
  testMode?: boolean;
  externalServiceID?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OrderPaymentsResponse extends StatusEnvelope {
  payments: Payment[];
}

export interface OrderRefundsResponse extends StatusEnvelope {
  refunds: unknown[];
}

export interface Order {
  _id: ObjectId;
  orderNumber?: string | number;
  business?: ObjectId;
  location?: ObjectId;
  uid?: string;
  status?: string;
  orderType?: OrderType;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  datePlaced?: string;
  dueDate?: string;
  dueASAP?: boolean;
  numItems?: number;
  lineItems?: unknown;
  totalPrice?: number;
  totalTax?: number;
  totalTip?: number;
  totalShipping?: number;
  currency?: string;
  shippingAddress?: unknown;
  deliveryDetails?: unknown;
  locationInfo?: Record<string, unknown>;
  loyalty?: { isLoyaltyTransaction: boolean; points: number };
  [key: string]: unknown;
}

/**
 * Only observed as `304 Not Modified` in the capture, so the body shape is
 * unverified. Treated as an open record.
 */
export type CurrentUser = Record<string, unknown>;
/** @see CurrentUser — also only observed as 304. */
export type UserAddressesResponse = Record<string, unknown>;
/** @see CurrentUser — also only observed as 304. */
export type LoyaltyProfileResponse = Record<string, unknown>;

export type AuthEventName = "auth:sign_in" | (string & {});
export type CartEventName = "cart:item_added" | (string & {});
export type CatalogEventName = "catalog:product_viewed" | (string & {});

export interface AnalyticsEvent<N extends string = string> {
  eventName: N;
  properties: Record<string, unknown> & { platform?: "mobile" | "web" | (string & {}) };
}
