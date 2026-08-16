/**
 * happier-api — unofficial client for the Happier Grocery commerce API
 * (`ecom-api.getjaldi.com`, a Jaldi/Vendora storefront backend).
 *
 * Reverse-engineered from a Proxyman capture of the iOS app. Nothing here is
 * endorsed by or affiliated with Happier Grocery.
 */

export { HappierClient } from "./client.ts";
export type { ClientConfig, RequestOptions } from "./http.ts";
export {
  HAPPIER_BASE_URL,
  HAPPIER_BUSINESS_ID,
  HAPPIER_LOCATION_ID,
  HAPPIER_USER_AGENT,
  HappierHttp,
} from "./http.ts";

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
} from "./auth.ts";
export type {
  AuthConfig,
  AuthSession,
  FirebaseAccountInfo,
  HappierIdTokenClaims,
} from "./auth.ts";

export { GraphQLApi, GET_ORDER_BY_ID_QUERY, PRODUCT_INVENTORY_QUERY } from "./graphql.ts";
export { TrpcApi } from "./trpc.ts";
export type { ProductFilters, ProductsGetAllInput, ProductsGetAllResult } from "./trpc.ts";

export {
  HappierApiError,
  HappierAuthError,
  HappierError,
  HappierGraphQLError,
  HappierTrpcError,
} from "./errors.ts";

export type * from "./types.ts";
