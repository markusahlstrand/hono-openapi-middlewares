# hono-openapi-middlewares

> [!NOTE]
> This is still work in progress.

A set of middlewares for using hono with zod-openapi:

- authentication. Validates the claims in the security scheme in the openapi spec.
- register components. Adds the security shemes to the openapi spec.
- swagger-ui. Serves the swagger-ui for the openapi spec.

## Installation

```bash
npm install openapi-middlewares
```

## Authentication middleware

The authentication middleware needs to be created using the factory mehtod as it needs to have acces to the app instance.

```typescript
const app = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use(createAuthMiddleware(app));
```