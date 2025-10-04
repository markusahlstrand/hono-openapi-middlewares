# hono-openapi-middlewares

A set of middlewares for using hono with zod-openapi:

- authentication and authorization. Validates the claims in the security scheme in the openapi spec.
- register components. Adds the security shemes to the openapi spec.
- swagger-ui (not yet implemented). Serves the swagger-ui for the openapi spec.

## Installation

```bash
npm install hono-openapi-middlewares
```

## Peer dependencies

The library has the following peer-dependencies that needs to be available:

- @hono/zod-openapi
- hono

## Authentication middleware

The authentication middleware needs to be created using the factory method as it needs to have access to the app instance.

```typescript
interface Bindings {
  JWKS_URL: string;
  JWKS_SERVICE: {
    // Makes it possible to call other cloudflare workers using a service reference
    fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  };
}

const app = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use(createAuthMiddleware(app));
```

## Register components

The register components middleware adds security schemes with AUTH_URL based on the environment. As environment variables aren't available until a context is established, the schemes are added on the first request.

```typescript
// Required environment variables:
interface Bindings {
  // The url of the auth service that is referenced from the swagger file
  AUTH_URL: string;
}

const app = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Registers security schemes based on AUTH_URL
app.use(registerComponent(app));

// After registration, your OpenAPI spec will include:
// securitySchemes:
//   Bearer:
//     type: oauth2
//     scheme: bearer
//     flows:
//       implicit:
//         authorizationUrl: <AUTH_URL from environment>
//         scopes:
//           openid: Basic user information
//           email: User email
//           profile: User profile information
```
