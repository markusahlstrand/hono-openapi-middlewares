declare type Fetcher = {
  fetch: typeof fetch;
};

export type Bindings = {
  JWKS_URL: string;
  JWKS_SERVICE: Fetcher;

  // Constants
  JWKS_CACHE_TIMEOUT_IN_SECONDS: number;
};
