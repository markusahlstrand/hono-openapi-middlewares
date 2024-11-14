# hono-openapi-middlewares

> [!NOTE]
> This is still an early version so expect bugs.

A set of middlewares for using hono with zod-openapi:

- authentication. Validates the claims in the security scheme in the openapi spec.
- register components. Adds the security shemes to the openapi spec.
- swagger-ui. Serves the swagger-ui for the openapi spec. (not yet implemented)

## Installation

```bash
npm install openapi-middlewares
```

## Authentication middleware

The authentication middleware needs to be created using the factory mehtod as it needs to have acces to the app instance.

```typescript
interface Bindings {
  JWKS_URL: string;
  JWKS_SERVICE: {
    // Makes it possible to call other cloudflare workers using a service reference
    fetch;
  };
}

const app = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use(createAuthMiddleware(app));
```

## Register components

The registrer components adds the security schemes with the AUTH_URL added based on the env. As the env aren't available until we get a context it needs to be added on the first request.

```typescript
const app = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use(registerComponents(app));
```
