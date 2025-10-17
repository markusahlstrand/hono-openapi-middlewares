import { OpenAPIHono } from '@hono/zod-openapi';
import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Jwt } from 'hono/utils/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { z } from 'zod';

export interface Fetcher {
  fetch: typeof fetch;
}

/**
 * JSON Web Key (JWK) schema for JWKS validation
 * Based on RFC 7517: https://tools.ietf.org/html/rfc7517
 */
const JWKSchema = z.object({
  kty: z.string(), // Key Type (required)
  use: z.string().optional(), // Public Key Use
  key_ops: z.array(z.string()).optional(), // Key Operations
  alg: z.string().optional(), // Algorithm
  kid: z.string().optional(), // Key ID
  x5u: z.string().optional(), // X.509 URL
  x5c: z.array(z.string()).optional(), // X.509 Certificate Chain
  x5t: z.string().optional(), // X.509 Certificate SHA-1 Thumbprint
  'x5t#S256': z.string().optional(), // X.509 Certificate SHA-256 Thumbprint
  // RSA-specific parameters
  n: z.string().optional(), // Modulus
  e: z.string().optional(), // Exponent
  // EC-specific parameters
  crv: z.string().optional(), // Curve
  x: z.string().optional(), // X Coordinate
  y: z.string().optional(), // Y Coordinate
  // Symmetric key parameter
  k: z.string().optional(), // Key Value
});

/**
 * JSON Web Key Set (JWKS) schema
 * Based on RFC 7517: https://tools.ietf.org/html/rfc7517#section-5
 */
const JWKSSchema = z.object({
  keys: z.array(JWKSchema).min(1, 'JWKS must contain at least one key'),
});

/**
 * Type inference from the JWKS schema
 */
export type JWKSData = z.infer<typeof JWKSSchema>;
export type JWK = z.infer<typeof JWKSchema>;

export interface AuthBindings {
  JWKS_URL: string;
  JWKS_SERVICE?: Fetcher;
}

export interface AuthVariables {
  user: JWTPayload;
  user_id: string;
}

export type AuthenticationGenerics = {
  Bindings: AuthBindings;
  Variables?: AuthVariables;
};

/**
 * Type guard to validate that permissions is a string array
 */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

/**
 * Convert Hono route syntax (:param) to OpenAPI syntax ({param})
 * Handles optional params (:id?) and typed params (:id{[0-9]+})
 * @internal Exported for testing purposes
 */
export function convertRouteSyntax(route: string) {
  // Match :paramName followed by optional type constraint {...} and/or optional marker ?
  // Examples: :id, :id?, :id{[0-9]+}, :id{[0-9]+}?
  return route.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]+\})?\??/g, '{$1}');
}

/**
 * Normalize a path for consistent comparison
 * Removes trailing slashes and collapses multiple consecutive slashes
 * Ensures leading slash
 * @internal Exported for testing purposes
 */
export function normalizePath(path: string): string {
  if (!path) return '/';

  // Remove trailing slashes (except for root path)
  // Collapse multiple consecutive slashes to single slash
  let normalized = path.replace(/\/+/g, '/').replace(/\/+$/, '');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  // Handle edge case: empty after removing trailing slash means root
  return normalized === '' ? '/' : normalized;
}

/**
 * Get the absolute path for a definition by combining basePath with the definition path
 * Normalizes slashes to prevent double slashes or missing leading slash
 * @internal Exported for testing purposes
 */
export function getAbsoluteDefinitionPath(
  basePath: string,
  definitionPath: string,
) {
  // Only skip normalization if basePath is not empty and definitionPath already starts with it
  if (basePath && definitionPath.startsWith(basePath)) {
    return definitionPath;
  }

  // Normalize paths: remove trailing slashes from basePath and leading slashes from definitionPath
  const normalizedBasePath = basePath.replace(/\/+$/, ''); // Remove trailing slashes
  const normalizedDefinitionPath = definitionPath.replace(/^\/+/, ''); // Remove leading slashes

  // Combine paths
  let combined =
    normalizedBasePath === ''
      ? normalizedDefinitionPath
      : `${normalizedBasePath}/${normalizedDefinitionPath}`;

  // Remove any double slashes
  combined = combined.replace(/\/+/g, '/');

  // Ensure the result starts with a slash
  return combined.startsWith('/') ? combined : `/${combined}`;
}

export interface AuthMiddlewareOptions {
  /**
   * Log level for the middleware. Defaults to "warn".
   * Set to "info" to enable detailed logging of authentication events.
   */
  logLevel?: 'info' | 'warn';
}

/**
 * This registers the authentication middleware. As it needs to read the OpenAPI definition, it needs to have a reference to the app.
 * @param app
 * @param options - Optional configuration options for the middleware
 */
export function createAuthMiddleware<H extends AuthenticationGenerics>(
  app: OpenAPIHono<H>,
  options: AuthMiddlewareOptions = {},
) {
  const { logLevel = 'warn' } = options;
  return async (ctx: Context, next: Next) => {
    let matchedPath = ctx.req.path;
    let basePath = '';

    // Try to use matchedRoutes for better route matching
    // Guard against undefined matchedRoutes (some Hono versions may not set it)
    // Prefer the last match (most specific/deepest) over parent routes by reversing
    const normalizedMethod = ctx.req.method.toUpperCase();
    let matchedRoute: { method: string; path: string } | undefined = undefined;

    try {
      if (ctx.req.matchedRoutes && Array.isArray(ctx.req.matchedRoutes)) {
        // Reverse to prefer the most specific (deepest) match
        const routes = [...ctx.req.matchedRoutes].reverse();
        matchedRoute = routes.find(
          (route) =>
            route.method.toUpperCase() === normalizedMethod &&
            route.path !== '/*',
        );
      }
    } catch {
      // Silently fail if matchedRoutes is not accessible
      matchedRoute = undefined;
    }

    if (matchedRoute) {
      // Convert Hono route syntax to OpenAPI syntax
      matchedPath = convertRouteSyntax(matchedRoute.path);

      basePath =
        'basePath' in matchedRoute && typeof matchedRoute.basePath === 'string'
          ? matchedRoute.basePath
          : '';
    }

    // Normalize both paths for consistent comparison
    const normalizedMatchedPath = normalizePath(matchedPath);

    const definition = app.openAPIRegistry.definitions.find((def) => {
      if (!('route' in def)) return false;

      const normalizedDefinitionPath = normalizePath(
        getAbsoluteDefinitionPath(basePath, def.route.path),
      );

      return (
        normalizedDefinitionPath === normalizedMatchedPath &&
        def.route.method.toUpperCase() === normalizedMethod
      );
    });

    if (definition && 'route' in definition) {
      const requiredPermissions = definition.route.security?.[0]?.Bearer;

      if (logLevel === 'info' && requiredPermissions) {
        console.info('Authentication middleware triggered', {
          route: `${ctx.req.method} ${matchedPath}`,
          requiredPermissions,
        });
      }

      // Bail if no Bearer is defined
      if (!requiredPermissions) {
        return await next();
      }

      const authHeader = ctx.req.header('authorization') || '';
      const [authType, bearer] = authHeader.split(' ');
      if (authType?.toLowerCase() !== 'bearer' || !bearer) {
        throw new HTTPException(403, {
          message: 'Missing bearer token',
        });
      }

      let jwksData: JWKSData;

      try {
        // Fetch JWKS keys
        const fetcher = ctx.env.JWKS_SERVICE?.fetch || fetch;
        const jwksResponse = await fetcher(ctx.env.JWKS_URL);

        if (!jwksResponse.ok) {
          // JWKS endpoint returned an error status
          throw new HTTPException(502, {
            message: `JWKS endpoint returned ${jwksResponse.status}`,
          });
        }

        let rawData: unknown;
        try {
          rawData = await jwksResponse.json();
        } catch {
          // Failed to parse JWKS response as JSON
          throw new HTTPException(502, {
            message: 'Failed to parse JWKS response',
          });
        }

        // Validate JWKS format with zod schema
        const parseResult = JWKSSchema.safeParse(rawData);
        if (!parseResult.success) {
          // Invalid JWKS format - provide detailed error from zod
          const errorMessage = parseResult.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', ');
          throw new HTTPException(502, {
            message: `Invalid JWKS format: ${errorMessage}`,
          });
        }

        jwksData = parseResult.data;
      } catch (err) {
        // Re-throw HTTPException as-is
        if (err instanceof HTTPException) {
          throw err;
        }

        // Network error or other fetch failure
        throw new HTTPException(503, {
          message: 'JWKS service unavailable',
        });
      }

      try {
        // Use Hono's JWT utility to verify the token with the fetched JWKS keys
        const payload = await Jwt.verifyWithJwks(bearer, {
          keys: jwksData.keys,
          verification: {
            exp: false, // Disable expiration check for now (can be configurable)
          },
        });

        // Store entire JWT payload in context
        ctx.set('user', payload);
        // Also set user_id for backward compatibility
        ctx.set('user_id', payload.sub);

        if (logLevel === 'info') {
          console.info('User authenticated', {
            user: payload,
          });
        }

        // Check permissions if required
        const permissions = isStringArray(payload.permissions)
          ? payload.permissions
          : [];
        if (
          requiredPermissions?.length &&
          !requiredPermissions.some((scope) => permissions.includes(scope))
        ) {
          throw new HTTPException(403, { message: 'Unauthorized' });
        }
      } catch (err) {
        // Re-throw HTTPException as-is (for permission check failures)
        if (err instanceof HTTPException) {
          throw err;
        }

        // JWT verification failed - this is a client error (invalid token)
        throw new HTTPException(403, {
          message: 'Invalid JWT signature',
        });
      }
    }

    // If we can't find a matching route or definition we pass on the request
    return await next();
  };
}
