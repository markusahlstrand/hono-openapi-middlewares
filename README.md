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

The authentication middleware validates JWT tokens using JWKS (JSON Web Key Set) and enforces permissions defined in your OpenAPI routes. It uses Hono's built-in JWT utilities for secure token verification.

### Basic Setup

```typescript
import { createAuthMiddleware } from 'hono-openapi-middlewares';
import { OpenAPIHono } from '@hono/zod-openapi';

interface Bindings {
  JWKS_URL: string;
  JWKS_SERVICE?: {
    // Optional: Makes it possible to call other Cloudflare workers using a service reference
    fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  };
}

const app = new OpenAPIHono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply authentication middleware globally
app.use(createAuthMiddleware(app));
```

### How Authentication Works

1. **Route-level security**: Define security requirements in your OpenAPI route definitions
2. **JWT validation**: The middleware validates JWT tokens against your JWKS endpoint
3. **Permission enforcement**: Checks if the token contains required permissions
4. **Context population**: Stores the full JWT payload as `user` and user ID as `user_id` in the context

### Defining Protected Routes

#### Basic Authentication (No Permissions)

To require authentication without specific permissions, add an empty Bearer array:

```typescript
import { createRoute } from '@hono/zod-openapi';

app.openapi(
  createRoute({
    method: 'get',
    path: '/protected',
    security: [
      {
        Bearer: [], // Requires valid JWT, no specific permissions
      },
    ],
    responses: {
      200: {
        description: 'Success',
      },
    },
  }),
  async (ctx) => {
    const user = ctx.get('user'); // Full JWT payload
    const userId = ctx.get('user_id'); // Shortcut to user.sub
    return ctx.json({ userId, email: user.email });
  },
);
```

#### Permission-Based Authorization

To require specific permissions, list them in the Bearer array:

```typescript
app.openapi(
  createRoute({
    method: 'post',
    path: '/posts',
    security: [
      {
        Bearer: ['posts:write', 'content:create'], // Requires at least one of these permissions
      },
    ],
    responses: {
      201: {
        description: 'Post created',
      },
    },
  }),
  async (ctx) => {
    // User has at least one of: posts:write OR content:create
    return ctx.json({ message: 'Post created' });
  },
);
```

#### Public Routes

Routes without a `security` property are public and don't require authentication:

```typescript
app.openapi(
  createRoute({
    method: 'get',
    path: '/public',
    // No security property - public route
    responses: {
      200: {
        description: 'Public data',
      },
    },
  }),
  async (ctx) => {
    return ctx.json({ message: 'Public route' });
  },
);
```

### Understanding Scopes vs Permissions

The middleware uses the `permissions` claim from your JWT token. This is compatible with various authentication providers:

- **Auth0**: Uses `permissions` array in the token
- **OAuth2 scopes**: Can be mapped to permissions
- **Custom auth**: Include `permissions` array in your JWT payload

**JWT Token Example:**

```json
{
  "sub": "user123",
  "permissions": ["posts:read", "posts:write", "admin:users"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Permission Matching Logic

The middleware uses **OR logic** for permissions:

- If a route requires `['posts:write', 'posts:delete']`
- The user needs at least **one** of these permissions to access the route
- Having `posts:write` is sufficient, even without `posts:delete`

**Example:**

```typescript
// Route requires one of these permissions
security: [{ Bearer: ['posts:write', 'posts:delete'] }];

// Token has: ["posts:write", "comments:moderate"]
// Result: ✅ Access granted (has posts:write)

// Token has: ["posts:read", "comments:moderate"]
// Result: ❌ 403 Unauthorized (missing required permissions)

// Token has: ["posts:write", "posts:delete"]
// Result: ✅ Access granted (has both)
```

### OpenAPI Specification Generation

The security requirements are automatically included in your OpenAPI specification:

```yaml
paths:
  /posts:
    post:
      security:
        - Bearer:
            - posts:write
            - content:create
      responses:
        '201':
          description: Post created
        '403':
          description: Unauthorized - Missing required permissions
```

### Error Responses

The middleware returns these HTTP exceptions:

| Status | Message               | Cause                                     |
| ------ | --------------------- | ----------------------------------------- |
| 403    | Missing bearer token  | No Authorization header or invalid format |
| 403    | Invalid JWT signature | Token validation failed or expired        |
| 403    | Unauthorized          | User lacks required permissions           |

### Advanced Configuration

#### Custom JWKS Fetcher (Cloudflare Workers)

For Cloudflare Workers with service bindings:

```typescript
interface Bindings {
  JWKS_URL: string;
  JWKS_SERVICE: {
    fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  };
}

// The middleware will use JWKS_SERVICE.fetch if available
// Falls back to global fetch if not provided
```

#### Accessing User Information

After successful authentication, the entire JWT payload is available in the context:

```typescript
app.openapi(route, async (ctx) => {
  // Access the full JWT payload
  const user = ctx.get('user');
  
  // Available properties (depending on your JWT):
  const userId = user.sub;           // Subject (user ID)
  const email = user.email;          // Email (if included)
  const permissions = user.permissions; // Permissions array
  const issuer = user.iss;           // Token issuer
  const audience = user.aud;         // Token audience
  
  // Or use the shortcut for user ID
  const userId = ctx.get('user_id'); // Same as user.sub
  
  // Use for database queries, logging, etc.
  const userProfile = await db.users.findById(userId);
  
  return ctx.json({ 
    userId,
    email,
    permissions,
    profile: userProfile 
  });
});
```

**TypeScript Support:**

To get proper TypeScript types, extend your app's Variables:

```typescript
import type { JWTPayload } from 'hono/utils/jwt/types';
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono<{
  Bindings: {
    JWKS_URL: string;
  };
  Variables: {
    user: JWTPayload;
    user_id: string;
  };
}>();

// Now you get full type safety
app.openapi(route, async (ctx) => {
  const user = ctx.get('user'); // Typed as JWTPayload
  const userId = ctx.get('user_id'); // Typed as string
});
```### Complete Example

```typescript
import { createAuthMiddleware } from 'hono-openapi-middlewares';
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';

const app = new OpenAPIHono<{
  Bindings: {
    JWKS_URL: string;
  };
}>();

// Apply authentication middleware
app.use(createAuthMiddleware(app));

// Public route - no authentication required
app.openapi(
  createRoute({
    method: 'get',
    path: '/public',
    responses: {
      200: { description: 'Public endpoint' },
    },
  }),
  async (ctx) => ctx.json({ message: 'Public' }),
);

// Protected route - requires valid JWT
app.openapi(
  createRoute({
    method: 'get',
    path: '/profile',
    security: [{ Bearer: [] }],
    responses: {
      200: { description: 'User profile' },
    },
  }),
  async (ctx) => {
    const user = ctx.get('user');
    return ctx.json({ 
      userId: user.sub,
      email: user.email,
      permissions: user.permissions 
    });
  },
);

// Permission-protected route - requires specific permissions
app.openapi(
  createRoute({
    method: 'post',
    path: '/admin/users',
    security: [{ Bearer: ['admin:users', 'admin:all'] }],
    responses: {
      201: { description: 'User created' },
    },
  }),
  async (ctx) => {
    const user = ctx.get('user');
    // User has admin:users OR admin:all permission
    // Access full user context for audit logging
    console.log(`User ${user.sub} created a new user`);
    return ctx.json({ message: 'User created' });
  },
);

export default app;
```

### Best Practices

#### Permission Naming Convention

Use a consistent naming convention for permissions:

- **Resource:Action** format: `posts:read`, `posts:write`, `users:delete`
- **Hierarchical**: `admin:all`, `admin:users`, `admin:content`
- **Descriptive**: Clear action verbs (read, write, create, update, delete)

#### Security Considerations

1. **Always use HTTPS** in production to protect JWT tokens in transit
2. **Validate JWKS_URL** comes from a trusted source
3. **Set appropriate token expiration** times in your auth provider
4. **Rotate signing keys** regularly at your JWKS endpoint
5. **Use specific permissions** rather than broad wildcards when possible

#### Testing

When writing tests, mock the JWKS_SERVICE to avoid external dependencies:

```typescript
const mockApp = testClient(app, {
  JWKS_URL: 'https://example.com/.well-known/jwks.json',
  JWKS_SERVICE: {
    fetch: async () =>
      new Response(
        JSON.stringify({
          keys: [
            {
              kid: 'key-id-123',
              alg: 'RS256',
              kty: 'RSA',
              use: 'sig',
              n: 'modulus...',
              e: 'AQAB',
            },
          ],
        }),
      ),
  },
});
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
