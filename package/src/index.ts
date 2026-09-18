/**
 * happier-api — unofficial client for the Happier Grocery commerce API
 * (`ecom-api.getjaldi.com`, a Jaldi/Vendora storefront backend).
 *
 * Reverse-engineered from a Proxyman capture of the iOS app. Nothing here is
 * endorsed by or affiliated with Happier Grocery.
 */

export { HappierClient } from "./client.js";
export type { ClientConfig, RequestOptions } from "./http.js";
export {
  HAPPIER_BASE_URL,
  HAPPIER_BUSINESS_ID,
  HAPPIER_LOCATION_ID,
  HAPPIER_USER_AGENT,
  HappierHttp,
} from "./http.js";

export {
  FirebaseAuth,
  HAPPIER_FIREBASE_API_KEY,
  HAPPIER_FIREBASE_APP_ID,
  HAPPIER_FIREBASE_PROJECT_ID,
  HAPPIER_FIREBASE_TENANT_ID,
  HAPPIER_IOS_BUNDLE_ID,
  decodeIdToken,
  getAccountInfo,
  isIdTokenExpired,
  refreshSession,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from "./auth.js";
export type {
  AuthConfig,
  AuthSession,
  FirebaseAccountInfo,
  HappierIdTokenClaims,
} from "./auth.js";

export { GraphQLApi, GET_ORDER_BY_ID_QUERY, PRODUCT_INVENTORY_QUERY } from "./graphql.js";
export { TrpcApi } from "./trpc.js";
export type {
  CategoriesWithProductsInput,
  CategoriesWithProductsResult,
  CategoryProduct,
  ProductFilters,
  ProductsGetAllInput,
  ProductsGetAllResult,
} from "./trpc.js";

export {
  HappierApiError,
  HappierAuthError,
  HappierError,
  HappierGraphQLError,
  HappierTrpcError,
} from "./errors.js";

export type * from "./types.js";
