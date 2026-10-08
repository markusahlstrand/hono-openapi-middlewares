# hono-openapi-middlewares

JWT authentication and permission checks driven by your `@hono/zod-openapi` route definitions. The library verifies tokens against a JSON Web Key Set (JWKS), exposes the authenticated user in Hono's context, and includes a helper for registering an OpenAPI security scheme.

## Installation

Install the library and its peer dependencies together:

```sh
npm install hono-openapi-middlewares @hono/zod-openapi@^1.6.3 hono@^4.13.13 zod@^4.6.5
```

| Dependency          | Supported version |
| ------------------- | ----------------- |
| `@hono/zod-openapi` | `^1.6.3`          |
| `hono`              | `^4.13.13`        |
| `zod`               | `^4.6.5`          |

These requirements describe the updated source in this repository. Check the peer dependencies of the published version when installing from npm.

## Quick start

This example uses Cloudflare Workers bindings. Other runtimes can provide the same bindings through Hono's request environment.

```typescript
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  createAuthMiddleware,
  type AuthBindings,
  type AuthVariables,
} from 'hono-openapi-middlewares';

const app = new OpenAPIHono<{
  Bindings: AuthBindings;
  Variables: AuthVariables;
}>();

// Register middleware before route handlers, using the same app instance.
app.use(createAuthMiddleware(app));

// Register a security scheme for the generated documentation.
app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    responses: {
      200: { description: 'Service is running' },
    },
  }),
  (c) => c.text('OK'),
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/profile',
    security: [{ Bearer: [] }],
    responses: {
      200: { description: 'Authenticated user' },
      403: { description: 'Missing or invalid token' },
    },
  }),
  (c) => c.json({ userId: c.get('user_id') }),
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/posts',
    security: [{ Bearer: ['posts:write', 'content:create'] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({ title: z.string().min(1) }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Post created' },
      403: { description: 'Missing token or permission' },
    },
  }),
  (c) => c.json({ title: c.req.valid('json').title }, 201),
);

app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'Posts API', version: '1.0.0' },
});

export default app;
```

Set `JWKS_URL` to your identity provider's trusted JWKS endpoint. Call protected routes with an `Authorization: Bearer <token>` header. Tokens need a `kid` header that matches a key in the JWKS and a signing algorithm in the configured allowlist.

Import `z` from `@hono/zod-openapi` when defining schemas that use `.openapi()` metadata.

## Route security and permissions

| Route definition                                            | Behavior                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| No `security`, or `security: []`                            | Public; authentication is skipped                            |
| `security: [{ Bearer: [] }]`                                | Requires a valid JWT                                         |
| `security: [{ Bearer: ['posts:write', 'content:create'] }]` | Requires a valid JWT with **at least one** listed permission |

Permission checks read the JWT's `permissions` claim as an array of strings:

```json
{
  "sub": "user123",
  "permissions": ["posts:read", "posts:write"]
}
```

This payload illustrates the claims used by the middleware; your provider should also issue appropriate time claims. Permissions use exact string matching. A permission such as `admin:all` has no special wildcard behavior. The OAuth `scope` claim is not read automatically.

The middleware matches the request method and route path against the supplied app's OpenAPI registry, including parameterized paths and base paths. If it finds no matching definition, it continues without authenticating.

Only `security[0].Bearer` is evaluated. Additional security entries, other scheme names, and document-level security are not enforced. Define `Bearer` on every route that this middleware should protect, and test protected routes when composing or mounting apps.

## Authentication options

```typescript
app.use(
  createAuthMiddleware(app, {
    allowedAlgorithms: ['RS256'],
    verifyExpiration: true,
    logLevel: 'warn',
  }),
);
```

| Option              | Default     | Behavior                                                                                                      |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `allowedAlgorithms` | `['RS256']` | Trusted asymmetric JWT signing algorithms                                                                     |
| `verifyExpiration`  | `true`      | Enables Hono's expiration check when an `exp` claim is present                                                |
| `logLevel`          | `'warn'`    | `'info'` logs matched security requirements and authenticated JWT payloads; `'warn'` disables those info logs |

Supported algorithms are `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512`, `ES256`, `ES384`, `ES512`, and `EdDSA`. Set the allowlist to the algorithms used by your provider, for example `allowedAlgorithms: ['ES256']`. An empty list rejects every token. Symmetric algorithms such as `HS256` are not supported by Hono's JWKS verifier.

Keep expiration verification enabled in production. The middleware does not require an `exp` claim or configure issuer (`iss`) or audience (`aud`) validation. Add those checks if your application requires them. Info logging includes the full verified payload, which may contain personal information.

### User context

Use the exported `AuthVariables` type in your app's `Variables`, as shown in the quick start. After successful authentication:

- `c.get('user')` contains the verified JWT payload, typed as Hono's `JWTPayload`.
- `c.get('user_id')` contains the payload's `sub` claim.

These values are populated only for authenticated requests. The middleware does not require `sub`, so ensure your provider supplies it if your handlers rely on `user_id`. Custom claims such as `email` and `permissions` need narrowing before use.

### Custom JWKS fetching

`AuthBindings` requires `JWKS_URL` and accepts an optional `JWKS_SERVICE` with a `fetch: typeof fetch` method. When supplied, the middleware calls `JWKS_SERVICE.fetch(JWKS_URL)`; otherwise it uses global `fetch`.

This supports service bindings or a custom fetch adapter. Tests can supply an adapter returning a JWKS containing a real test public key:

```typescript
const env: AuthBindings = {
  JWKS_URL: 'https://auth.example.com/.well-known/jwks.json',
  JWKS_SERVICE: {
    fetch: async () => Response.json({ keys: [publicJwk] }),
  },
};

const response = await app.request(
  '/profile',
  { headers: { Authorization: `Bearer ${signedTestToken}` } },
  env,
);
```

Here, `publicJwk` and `signedTestToken` must come from the same test key pair. The middleware fetches the JWKS on every authenticated request; it does not cache keys.

### Error responses

The middleware throws Hono `HTTPException` errors. Hono's default error handler returns the message as plain text; an app-level error handler can customize the response.

| Status | Message                           | Cause                                                                   |
| ------ | --------------------------------- | ----------------------------------------------------------------------- |
| 403    | `Missing bearer token`            | Missing bearer header or token                                          |
| 403    | `Invalid JWT signature`           | JWT verification failed, including expiration or a disallowed algorithm |
| 403    | `Unauthorized`                    | No required permission matched                                          |
| 502    | `JWKS endpoint returned {status}` | JWKS endpoint returned a non-success status                             |
| 502    | `Failed to parse JWKS response`   | JWKS response could not be parsed as JSON                               |
| 502    | `Invalid JWKS format: …`          | JWKS failed schema validation, such as an empty or missing `keys` array |
| 503    | `JWKS service unavailable`        | JWKS fetch failed                                                       |

Add error responses to your route definitions if you want them included in the generated OpenAPI document. The middleware does not add response definitions automatically.

## Environment-based security scheme registration

For an OAuth2 implicit-flow scheme whose authorization URL comes from the environment, use `registerComponent`:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerComponent } from 'hono-openapi-middlewares';

const app = new OpenAPIHono<{
  Bindings: { AUTH_URL: string };
}>();

app.use(registerComponent(app));
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: { title: 'API', version: '1.0.0' },
});
```

On the first request, this helper registers a scheme named `Bearer` with `AUTH_URL` as its implicit-flow authorization URL and `openid`, `email`, and `profile` scopes. It only affects documentation; install `createAuthMiddleware` separately to enforce authentication.

The helper currently tracks initialization at module level, so it registers only once across app instances sharing that module. For multiple apps, or for a plain HTTP bearer scheme, register the scheme directly on each app's `openAPIRegistry`, as in the quick start. Do not register both schemes under the same name.

## Migrating from Zod 3 / Zod OpenAPI 0.x

1. Upgrade `@hono/zod-openapi`, `hono`, and `zod` together to the peer versions above.
2. Update application schemas for Zod 4. Import OpenAPI-enabled `z` from `@hono/zod-openapi`.
3. Check your identity provider's signing algorithm. RS256 is the middleware default; configure `allowedAlgorithms` if you use another algorithm.
4. Verify that a valid token succeeds, a token with an invalid signature fails, and a token without the required permission is rejected.

The new peer requirements replace support for Zod 3 and Zod OpenAPI 0.x. The library passes an explicit algorithm allowlist to Hono's newer JWKS verification API.

## Development

```sh
yarn install --frozen-lockfile
yarn lint
yarn format:ci-cd
yarn type-check
yarn test
yarn build
```

The build writes ESM, CommonJS, and TypeScript declarations to `build/`.

## License

MIT
