import type { FirebaseAuth } from "./auth.ts";
import { HappierApiError } from "./errors.ts";

export const HAPPIER_BASE_URL = "https://ecom-api.getjaldi.com";

/** Happier Grocery's business id, sent in the `business` header. */
export const HAPPIER_BUSINESS_ID = "6499aa6a78f0258111803a89";

/** The Happier Grocery store location observed in the capture. */
export const HAPPIER_LOCATION_ID = "6499ba0478f0258111803da0";

/** User-Agent the iOS app sends. */
export const HAPPIER_USER_AGENT = "Happier/1 CFNetwork/3896.100.1.2.1 Darwin/27.0.0";

export interface ClientConfig {
  /** Defaults to `https://ecom-api.getjaldi.com`. */
  baseUrl?: string;
  /** Value of the `business` header. Defaults to Happier Grocery. */
  businessId?: string;
  /** Value of the `location` header. Defaults to the observed store. */
  locationId?: string;
  /** Supplies (and refreshes) the Firebase ID token. */
  auth?: FirebaseAuth;
  /** Use a fixed ID token instead of an {@link FirebaseAuth} instance. */
  idToken?: string;
  userAgent?: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Injectable fetch, for tests or proxies. */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Send the `location` header (tRPC, GraphQL and inventory routes want it). */
  sendLocation?: boolean;
  /**
   * Also mirror the token into a plain `authorization` header.
   * `/api/v2/user/loyalty/get-customer-card-list` is the one route observed
   * requiring this in addition to `x-vendora-authentication`.
   */
  mirrorAuthorization?: boolean;
  /** Skip attaching credentials even when the client has them. */
  anonymous?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Thin transport over `ecom-api.getjaldi.com`.
 *
 * Handles the header contract the app uses: `x-vendora-authentication` carries a
 * raw Firebase ID token (no `Bearer` prefix), `business` scopes the tenant, and
 * `location` scopes catalog/pricing reads.
 */
export class HappierHttp {
  readonly baseUrl: string;
  readonly businessId: string;
  readonly locationId: string;
  readonly auth: FirebaseAuth | undefined;

  readonly #idToken: string | undefined;
  readonly #userAgent: string;
  readonly #extraHeaders: Record<string, string>;
  readonly #fetch: typeof globalThis.fetch;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? HAPPIER_BASE_URL).replace(/\/$/, "");
    this.businessId = config.businessId ?? HAPPIER_BUSINESS_ID;
    this.locationId = config.locationId ?? HAPPIER_LOCATION_ID;
    this.auth = config.auth;
    this.#idToken = config.idToken;
    this.#userAgent = config.userAgent ?? HAPPIER_USER_AGENT;
    this.#extraHeaders = config.headers ?? {};
    this.#fetch = config.fetch ?? globalThis.fetch;
  }

  /** Current ID token, refreshed if the client owns a {@link FirebaseAuth}. */
  async getIdToken(): Promise<string | undefined> {
    if (this.auth) return this.auth.getIdToken();
    return this.#idToken;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path, this.baseUrl + "/");
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": this.#userAgent,
      business: this.businessId,
      ...this.#extraHeaders,
      ...options.headers,
    };

    if (options.sendLocation) headers.location ??= this.locationId;

    if (!options.anonymous) {
      const token = await this.getIdToken();
      if (token) {
        headers["x-vendora-authentication"] = token;
        if (options.mirrorAuthorization) headers.authorization = token;
      }
    }

    const hasBody = options.body !== undefined;
    if (hasBody) headers["content-type"] ??= "application/json";

    const method = options.method ?? (hasBody ? "POST" : "GET");
    const res = await this.#fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (res.status === 204 || res.status === 304) return undefined as T;

    const text = await res.text();
    let parsed: unknown = text;
    if (text && (res.headers.get("content-type") ?? "").includes("json")) {
      try {
        parsed = JSON.parse(text);
      } catch {
        /* fall back to raw text */
      }
    }

    if (!res.ok) {
      throw new HappierApiError({ status: res.status, method, url: url.toString(), body: parsed });
    }

    return parsed as T;
  }
}
