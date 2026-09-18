import { HappierTrpcError } from "./errors.js";
import type { HappierHttp } from "./http.js";
import type {
  ObjectId,
  OrderType,
  Product,
  ProductCategory,
  ProductInventory,
  ProductSubCategory,
} from "./types.js";

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

  /** Search / browse the catalog. Paginated: pass `nextPage` back as `cursor` until it's `null`. */
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

  /** Sub-categories of a category, by its `identifier` (e.g. `"PRODUCE"`). */
  getSubCategories(input: { category: string }): Promise<ProductSubCategory[]> {
    return this.query<ProductSubCategory[]>("products.getSubCategories", input);
  }

  /**
   * The home-screen shelves: every category in a department with its first ten
   * products. Products are the lightweight {@link CategoryProduct} shape, not
   * full inventory records.
   */
  getCategoriesWithProducts(
    input: CategoriesWithProductsInput = {},
  ): Promise<CategoriesWithProductsResult> {
    return this.query<CategoriesWithProductsResult>("products.getCategoriesWithProducts", {
      department: "GROCERY",
      locationID: this.#http.locationId,
      orderType: "PICKUP",
      ...input,
    });
  }

  /** Number of orders the signed-in user has placed since `fromDate`. */
  getUserOrderCount(input: { fromDate: string }): Promise<number> {
    return this.query<number>("orders.getUserOrderCount", input);
  }
}

export interface ProductsGetAllInput {
  searchQuery?: string;
  /** Category `identifier`, e.g. `"PRODUCE"`. */
  category?: string;
  /** Sub-category `identifier`, e.g. `"FRESHCUTS"`. */
  subCategory?: string;
  brands?: string[];
  attributes?: string[];
  tags?: string[];
  orderType?: OrderType;
  /** Server-side semantic search — the app sets this for free-text queries. */
  useSemanticSearch?: boolean;
  /** 1-based page number — feed the previous result's `nextPage` back in here. */
  cursor?: number;
  direction?: "forward" | "backward";
}

export interface ProductsGetAllResult {
  products: Array<ProductInventory & { product: Product }>;
  /** Next `cursor` value; `null` on the last page. */
  nextPage: number | null;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}

export interface CategoriesWithProductsInput {
  /** @default "GROCERY" */
  department?: string;
  /** @default the client's location */
  locationID?: ObjectId;
  /** @default "PICKUP" */
  orderType?: OrderType;
}

/** Trimmed inventory record used on category shelves. */
export interface CategoryProduct {
  id: ObjectId;
  product: Product;
  price: number;
  inStock: boolean;
  active: boolean;
  location: ObjectId;
  ranking?: number;
  soldByWeight?: boolean;
  allowsPickup?: boolean;
  allowsDelivery?: boolean;
  allowsShipping?: boolean;
  [key: string]: unknown;
}

export interface CategoriesWithProductsResult {
  categories: Array<ProductCategory & { products: CategoryProduct[] }>;
}

export interface ProductFilters {
  brands: string[];
  attributes: string[];
  tags: string[];
}

export type { ObjectId };
