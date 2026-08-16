/**
 * Authentication for the Happier Grocery API.
 *
 * Happier runs no login endpoint of its own. The app authenticates directly
 * against **Google Identity Platform (Firebase Auth)** in *multi-tenant* mode,
 * then presents the resulting Firebase ID token to `ecom-api.getjaldi.com` in
 * the `x-vendora-authentication` header.
 *
 * The iOS app is on Firebase SDK 10.29.0, which still uses the **legacy v3
 * `relyingparty` endpoints on `www.googleapis.com`** rather than the newer
 * `identitytoolkit.googleapis.com/v1/accounts:*` aliases. This module mirrors
 * the app exactly — same host, same paths, same client headers — because the
 * API key is bundle-restricted and Google rejects calls that don't identify
 * themselves as the app.
 *
 * Captured contract:
 *
 * ```http
 * POST https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=AIza…
 * x-ios-bundle-identifier: com.happier.mobile
 * x-firebase-gmpid: 1:1025060920555:ios:bd9c0fa95303a4104a72ae
 * content-type: application/json
 *
 * {"email":"…","password":"…","clientType":"CLIENT_TYPE_IOS",
 *  "tenantId":"happier-grocery-e8oja","returnSecureToken":true}
 * ```
 */

import { HappierAuthError } from "./errors.js";

/** Google Cloud project backing Happier's Firebase Auth. */
export const HAPPIER_FIREBASE_PROJECT_ID = "upbeat-nova-376618";

/** Identity Platform tenant that Happier Grocery users live in. */
export const HAPPIER_FIREBASE_TENANT_ID = "happier-grocery-e8oja";

/**
 * Firebase Web API key shipped in the Happier iOS app.
 *
 * Firebase API keys are public client identifiers, not secrets — access is
 * gated by the bundle-id restriction and by Identity Platform itself.
 */
export const HAPPIER_FIREBASE_API_KEY = "AIzaSyABE1IfEuM2otawLA3YxezQaS36nbR-3Jg";

/** iOS bundle id the API key is restricted to. */
export const HAPPIER_IOS_BUNDLE_ID = "com.happier.mobile";

/** Firebase app id (`x-firebase-gmpid`). */
export const HAPPIER_FIREBASE_APP_ID = "1:1025060920555:ios:bd9c0fa95303a4104a72ae";

const RELYING_PARTY = "https://www.googleapis.com/identitytoolkit/v3/relyingparty";
const SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";

const FIREBASE_SDK_VERSION = "10.29.0";
const APP_VERSION = "1.2.1";

/** Refresh this many milliseconds before the token actually expires. */
const REFRESH_SKEW_MS = 60_000;

export interface AuthConfig {
  /**
   * Firebase Web API key. Defaults to the app's own key
   * ({@link HAPPIER_FIREBASE_API_KEY}), overridable via
   * `process.env.HAPPIER_FIREBASE_API_KEY`.
   */
  apiKey?: string;
  /** Override the Identity Platform tenant. Defaults to Happier Grocery's. */
  tenantId?: string;
  /** Override the iOS bundle id sent as `x-ios-bundle-identifier`. */
  bundleId?: string;
  /** Override the Firebase app id sent as `x-firebase-gmpid`. */
  appId?: string;
  /** Injectable fetch, for tests or proxies. */
  fetch?: typeof globalThis.fetch;
}

/** A signed-in session. */
export interface AuthSession {
  /** Firebase ID token — the value sent as `x-vendora-authentication`. */
  idToken: string;
  /** Long-lived token used to mint new ID tokens. Persist this, not `idToken`. */
  refreshToken: string;
  /** Firebase UID (`localId` / `user_id` claim). */
  uid: string;
  email: string;
  displayName?: string;
  /** Epoch milliseconds at which `idToken` expires. */
  expiresAt: number;
}

/** Claims carried by a Happier Firebase ID token. */
export interface HappierIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  auth_time: number;
  iat: number;
  exp: number;
  firebase: {
    sign_in_provider: string;
    tenant: string;
    identities: Record<string, string[]>;
  };
}

/** Identity Platform account record, as returned by `getAccountInfo`. */
export interface FirebaseAccountInfo {
  localId: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  tenantId: string;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string;
  lastRefreshAt?: string;
  passwordUpdatedAt?: number;
  providerUserInfo?: Array<{
    providerId: string;
    email?: string;
    displayName?: string;
    federatedId?: string;
    rawId?: string;
  }>;
  [key: string]: unknown;
}

function apiKeyOf(config: AuthConfig): string {
  return (
    config.apiKey ??
    globalThis.process?.env?.HAPPIER_FIREBASE_API_KEY ??
    HAPPIER_FIREBASE_API_KEY
  );
}

/**
 * Client headers the Firebase iOS SDK sends. The API key is restricted to
 * `com.happier.mobile`, so `x-ios-bundle-identifier` is load-bearing — drop it
 * and Google answers 403.
 */
function firebaseHeaders(config: AuthConfig): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "*/*",
    "accept-language": "en",
    "x-ios-bundle-identifier": config.bundleId ?? HAPPIER_IOS_BUNDLE_ID,
    "x-firebase-gmpid": config.appId ?? HAPPIER_FIREBASE_APP_ID,
    "x-client-version": `iOS/FirebaseSDK/${FIREBASE_SDK_VERSION}/FirebaseCore-iOS`,
    "user-agent": `FirebaseAuth.iOS/${FIREBASE_SDK_VERSION} ${
      config.bundleId ?? HAPPIER_IOS_BUNDLE_ID
    }/${APP_VERSION} iPhone/27.0 hw/iPhone18_1`,
  };
}

async function relyingParty<T>(
  config: AuthConfig,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const doFetch = config.fetch ?? globalThis.fetch;
  const url = `${RELYING_PARTY}/${method}?key=${encodeURIComponent(apiKeyOf(config))}`;

  const res = await doFetch(url, {
    method: "POST",
    headers: firebaseHeaders(config),
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new HappierAuthError({
      code: json?.error?.message ?? `HTTP_${res.status}`,
      status: res.status,
      body: json,
    });
  }
  return json as T;
}

/**
 * Decode (without verifying) the claims of a Firebase ID token.
 *
 * Signature verification is Happier's job, not the client's — this is only for
 * reading `exp`, `email`, and the tenant.
 */
export function decodeIdToken(idToken: string): HappierIdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) throw new HappierAuthError({ code: "MALFORMED_TOKEN", status: 0, body: idToken });

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json =
    typeof atob === "function"
      ? decodeURIComponent(
          Array.from(atob(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
        )
      : Buffer.from(padded, "base64").toString("utf8");

  return JSON.parse(json) as HappierIdTokenClaims;
}

/** True if `idToken` is expired (or within `skewMs` of expiring). */
export function isIdTokenExpired(idToken: string, skewMs = REFRESH_SKEW_MS): boolean {
  try {
    return decodeIdToken(idToken).exp * 1000 - skewMs <= Date.now();
  } catch {
    return true;
  }
}

/**
 * **The authentication function.** Exchange an email + password for a Happier
 * session, exactly as the iOS app does.
 *
 * @example
 * const session = await signInWithEmailAndPassword(
 *   "you@example.com",
 *   process.env.HAPPIER_PASSWORD!,
 * );
 * // → { idToken, refreshToken, uid, email, displayName, expiresAt }
 *
 * @throws {HappierAuthError} `.code` carries Firebase's string, e.g.
 * `EMAIL_NOT_FOUND`, `INVALID_PASSWORD`, `USER_DISABLED`,
 * `TOO_MANY_ATTEMPTS_TRY_LATER`.
 */
export async function signInWithEmailAndPassword(
  email: string,
  password: string,
  config: AuthConfig = {},
): Promise<AuthSession> {
  const res = await relyingParty<{
    idToken: string;
    refreshToken: string;
    expiresIn: string;
    localId: string;
    email: string;
    displayName?: string;
    registered: boolean;
  }>(config, "verifyPassword", {
    email,
    password,
    clientType: "CLIENT_TYPE_IOS",
    tenantId: config.tenantId ?? HAPPIER_FIREBASE_TENANT_ID,
    returnSecureToken: true,
  });

  return {
    idToken: res.idToken,
    refreshToken: res.refreshToken,
    uid: res.localId,
    email: res.email,
    displayName: res.displayName,
    expiresAt: Date.now() + Number(res.expiresIn) * 1000,
  };
}

/** Register a new Happier account in the tenant. */
export async function signUpWithEmailAndPassword(
  email: string,
  password: string,
  config: AuthConfig = {},
): Promise<AuthSession> {
  const res = await relyingParty<{
    idToken: string;
    refreshToken: string;
    expiresIn: string;
    localId: string;
    email: string;
  }>(config, "signupNewUser", {
    email,
    password,
    clientType: "CLIENT_TYPE_IOS",
    tenantId: config.tenantId ?? HAPPIER_FIREBASE_TENANT_ID,
    returnSecureToken: true,
  });

  return {
    idToken: res.idToken,
    refreshToken: res.refreshToken,
    uid: res.localId,
    email: res.email,
    expiresAt: Date.now() + Number(res.expiresIn) * 1000,
  };
}

/** Send Happier's password-reset email. */
export async function sendPasswordResetEmail(email: string, config: AuthConfig = {}): Promise<void> {
  await relyingParty(config, "getOobConfirmationCode", {
    email,
    requestType: "PASSWORD_RESET",
    clientType: "CLIENT_TYPE_IOS",
    tenantId: config.tenantId ?? HAPPIER_FIREBASE_TENANT_ID,
  });
}

/** Fetch the Identity Platform account record behind an ID token. */
export async function getAccountInfo(
  idToken: string,
  config: AuthConfig = {},
): Promise<FirebaseAccountInfo | undefined> {
  const res = await relyingParty<{ users: FirebaseAccountInfo[] }>(config, "getAccountInfo", {
    idToken,
  });
  return res.users?.[0];
}

/**
 * Mint a fresh ID token from a refresh token.
 *
 * Note this hits `securetoken.googleapis.com` with a form-encoded body, not the
 * relyingparty API, and takes no `tenantId` — the tenant rides in the token.
 */
export async function refreshSession(
  refreshToken: string,
  config: AuthConfig = {},
): Promise<Pick<AuthSession, "idToken" | "refreshToken" | "uid" | "expiresAt">> {
  const doFetch = config.fetch ?? globalThis.fetch;
  const url = `${SECURE_TOKEN}?key=${encodeURIComponent(apiKeyOf(config))}`;

  const { "content-type": _drop, ...headers } = firebaseHeaders(config);
  const res = await doFetch(url, {
    method: "POST",
    headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new HappierAuthError({
      code: json?.error?.message ?? `HTTP_${res.status}`,
      status: res.status,
      body: json,
    });
  }

  return {
    idToken: json.id_token,
    refreshToken: json.refresh_token,
    uid: json.user_id,
    expiresAt: Date.now() + Number(json.expires_in) * 1000,
  };
}

/**
 * A session holder that keeps a valid ID token available.
 *
 * Hand one of these to `HappierClient` and every request gets a live token;
 * concurrent callers share a single in-flight refresh.
 */
export class FirebaseAuth {
  #session: AuthSession | null = null;
  #refreshing: Promise<AuthSession> | null = null;
  readonly #config: AuthConfig;

  constructor(config: AuthConfig = {}) {
    this.#config = config;
  }

  /** Restore from a persisted refresh token (e.g. from a keychain or env var). */
  static fromRefreshToken(refreshToken: string, config: AuthConfig = {}): FirebaseAuth {
    const auth = new FirebaseAuth(config);
    auth.#session = { idToken: "", refreshToken, uid: "", email: "", expiresAt: 0 };
    return auth;
  }

  /** Restore from a session previously returned by {@link signInWithEmailAndPassword}. */
  static fromSession(session: AuthSession, config: AuthConfig = {}): FirebaseAuth {
    const auth = new FirebaseAuth(config);
    auth.#session = session;
    return auth;
  }

  get session(): AuthSession | null {
    return this.#session;
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    this.#session = await signInWithEmailAndPassword(email, password, this.#config);
    return this.#session;
  }

  signOut(): void {
    this.#session = null;
    this.#refreshing = null;
  }

  /** The account record for the current session. */
  async accountInfo(): Promise<FirebaseAccountInfo | undefined> {
    return getAccountInfo(await this.getIdToken(), this.#config);
  }

  /** Return a non-expired ID token, refreshing first if necessary. */
  async getIdToken(): Promise<string> {
    const session = this.#session;
    if (!session) {
      throw new HappierAuthError({
        code: "NOT_SIGNED_IN",
        status: 0,
        body: "Call signIn() first, or construct with FirebaseAuth.fromRefreshToken().",
      });
    }

    if (session.idToken && session.expiresAt - REFRESH_SKEW_MS > Date.now()) {
      return session.idToken;
    }

    this.#refreshing ??= refreshSession(session.refreshToken, this.#config)
      .then((refreshed) => {
        this.#session = { ...session, ...refreshed };
        return this.#session;
      })
      .finally(() => {
        this.#refreshing = null;
      });

    return (await this.#refreshing).idToken;
  }
}
