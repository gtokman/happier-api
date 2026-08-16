import { HappierTrpcError } from "./errors.js";
import type { HappierHttp } from "./http.js";
import type { ObjectId, OrderType, Product, ProductInventory } from "./types.js";

/**
 * tRPC surface at `GET /trpc/<procedures>?batch=1&input=<json>`.
 *
 * The app uses tRPC's HTTP batch link: procedure names are joined with commas in
 * the path, and `input` is a JSON object keyed by the procedure's index. The
 * response is a positional array of `{ result: { data } }` envelopes.
 *
 * ```http
 * GET /trpc/products.getFilters,products.getAll?batch=1
 *     &input={"0":{"searchQuery":"Sardines"},"1":{"orderType":"PICKUP",...}}
 * ```
 */
export class TrpcApi {
  readonly #http: HappierHttp;

  constructor(http: HappierHttp) {
    this.#http = http;
  }

  /**
   * Call one procedure.
   *
   * @example
   * const count = await client.trpc.query<number>("orders.getUserOrderCount", {
   *   fromDate: new Date(Date.now() - 30 * 864e5).toISOString(),
   * });
   */
  async query<T>(procedure: string, input?: unknown): Promise<T> {
    const [first] = await this.batch<[T]>([{ procedure, input }]);
    return first as T;
  }

  /**
   * Call several procedures in a single round trip, the way the app does.
   *
   * @example
   * const [filters, products] = await client.trpc.batch([
   *   { procedure: "products.getFilters", input: { searchQuery: "Sardines" } },
   *   { procedure: "products.getAll", input: { searchQuery: "Sardines", orderType: "PICKUP" } },
   * ]);
   */
  async batch<T extends unknown[] = unknown[]>(
    calls: Array<{ procedure: string; input?: unknown }>,
    options: { signal?: AbortSignal } = {},
  ): Promise<T> {
    const path = `trpc/${calls.map((c) => c.procedure).join(",")}`;
    const input: Record<string, unknown> = {};
    calls.forEach((call, index) => {
      input[String(index)] = call.input ?? {};
    });

    const envelopes = await this.#http.request<
      Array<{ result?: { data: unknown }; error?: { json?: any; message?: string; code?: string } }>
    >(path, {
      query: { batch: 1, input: JSON.stringify(input) },
      sendLocation: true,
      headers: { "content-type": "application/json" },
      signal: options.signal,
    });

    return envelopes.map((envelope, index) => {
      if (envelope?.error) {
        const detail = envelope.error.json?.message ? envelope.error.json : envelope.error;
        throw new HappierTrpcError({
          procedure: calls[index]!.procedure,
          message: detail?.message ?? "unknown tRPC error",
          code: detail?.data?.code ?? detail?.code,
          data: detail,
        });
      }
      return envelope?.result?.data;
    }) as T;
  }

  // ---- Typed wrappers for the procedures seen in the capture ----------------

  /** Search / browse the catalog. Cursor-paginated. */
  getAllProducts(input: ProductsGetAllInput = {}): Promise<ProductsGetAllResult> {
    return this.query<ProductsGetAllResult>("products.getAll", {
      brands: [],
      attributes: [],
      tags: [],
      orderType: "PICKUP",
      ...input,
    });
  }

  /** Facet values (brands / attributes / tags) available for a search. */
  getFilters(input: { searchQuery?: string; category?: string } = {}): Promise<ProductFilters> {
    return this.query<ProductFilters>("products.getFilters", input);
  }

  getSubCategories(input: { category: string }): Promise<unknown> {
    return this.query("products.getSubCategories", input);
  }

  getCategoriesWithProducts(input: Record<string, unknown> = {}): Promise<unknown> {
    return this.query("products.getCategoriesWithProducts", input);
  }

  /** Number of orders the signed-in user has placed since `fromDate`. */
  getUserOrderCount(input: { fromDate: string }): Promise<number> {
    return this.query<number>("orders.getUserOrderCount", input);
  }
}

export interface ProductsGetAllInput {
  searchQuery?: string;
  category?: string;
  subCategory?: string;
  brands?: string[];
  attributes?: string[];
  tags?: string[];
  orderType?: OrderType;
  /** Server-side semantic search — the app sets this for free-text queries. */
  useSemanticSearch?: boolean;
  cursor?: number;
  direction?: "forward" | "backward";
}

export interface ProductsGetAllResult {
  products: Array<ProductInventory & { product: Product }>;
  nextCursor?: number | null;
  prevCursor?: number | null;
  [key: string]: unknown;
}

export interface ProductFilters {
  brands: string[];
  attributes: string[];
  tags: string[];
}

export type { ObjectId };
