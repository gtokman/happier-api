/** Base error for everything this package throws. */
export class HappierError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "HappierError";
  }
}

/** A non-2xx response from ecom-api.getjaldi.com. */
export class HappierApiError extends HappierError {
  readonly status: number;
  readonly method: string;
  readonly url: string;
  readonly body: unknown;

  constructor(args: { status: number; method: string; url: string; body: unknown }) {
    super(`${args.method} ${new URL(args.url).pathname} failed with ${args.status}`);
    this.name = "HappierApiError";
    this.status = args.status;
    this.method = args.method;
    this.url = args.url;
    this.body = args.body;
  }
}

/**
 * A failure from Google Identity Platform (the auth backend).
 *
 * `code` is Firebase's machine-readable string, e.g. `EMAIL_NOT_FOUND`,
 * `INVALID_PASSWORD`, `INVALID_LOGIN_CREDENTIALS`, `USER_DISABLED`,
 * `TOO_MANY_ATTEMPTS_TRY_LATER`, `TOKEN_EXPIRED`.
 */
export class HappierAuthError extends HappierError {
  readonly code: string;
  readonly status: number;
  readonly body: unknown;

  constructor(args: { code: string; status: number; body: unknown }) {
    super(`Authentication failed: ${args.code}`);
    this.name = "HappierAuthError";
    this.code = args.code;
    this.status = args.status;
    this.body = args.body;
  }
}

/** A tRPC procedure returned an error envelope inside a 200 response. */
export class HappierTrpcError extends HappierError {
  readonly procedure: string;
  readonly code: string | undefined;
  readonly data: unknown;

  constructor(args: { procedure: string; message: string; code?: string; data?: unknown }) {
    super(`tRPC ${args.procedure} failed: ${args.message}`);
    this.name = "HappierTrpcError";
    this.procedure = args.procedure;
    this.code = args.code;
    this.data = args.data;
  }
}

/** A GraphQL response carried an `errors` array. */
export class HappierGraphQLError extends HappierError {
  readonly errors: Array<{ message: string; [k: string]: unknown }>;

  constructor(operationName: string, errors: Array<{ message: string; [k: string]: unknown }>) {
    super(`GraphQL ${operationName} failed: ${errors.map((e) => e.message).join("; ")}`);
    this.name = "HappierGraphQLError";
    this.errors = errors;
  }
}
