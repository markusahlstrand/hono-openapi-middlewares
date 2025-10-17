import { OpenAPIHono } from '@hono/zod-openapi';
import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Jwt } from 'hono/utils/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

export interface Fetcher {
  fetch: typeof fetch;
}

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
 */
function convertRouteSyntax(route: string) {
  return route.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

/**
 * Get the absolute path for a definition by combining basePath with the definition path
 */
function getAbsoluteDefinitionPath(basePath: string, definitionPath: string) {
  if (definitionPath.startsWith(basePath)) {
    return definitionPath;
  }
  return basePath + definitionPath;
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
    const matchedRoute = ctx.req.matchedRoutes.find(
      (route) =>
        route.method.toUpperCase() === ctx.req.method && route.path !== '/*',
    );

    if (matchedRoute) {
      // Convert Hono route syntax to OpenAPI syntax
      matchedPath = convertRouteSyntax(matchedRoute.path);

      basePath =
        'basePath' in matchedRoute && typeof matchedRoute.basePath === 'string'
          ? matchedRoute.basePath
          : '';
    }

    const definition = app.openAPIRegistry.definitions.find(
      (def) =>
        'route' in def &&
        getAbsoluteDefinitionPath(basePath, def.route.path) === matchedPath &&
        def.route.method.toUpperCase() === ctx.req.method.toUpperCase(),
    );

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

      try {
        // Fetch JWKS keys
        const fetcher = ctx.env.JWKS_SERVICE?.fetch || fetch;
        const jwksResponse = await fetcher(ctx.env.JWKS_URL);

        if (!jwksResponse.ok) {
          throw new Error('Failed to fetch JWKS');
        }

        const jwksData = await jwksResponse.json();

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
        // Re-throw HTTPException as-is (for Unauthorized errors)
        if (err instanceof HTTPException) {
          throw err;
        }

        throw new HTTPException(403, {
          message: 'Invalid JWT signature',
        });
      }
    }

    // If we can't find a matching route or definition we pass on the request
    return await next();
  };
}
