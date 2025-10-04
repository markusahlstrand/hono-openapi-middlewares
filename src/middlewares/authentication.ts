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
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * This registers the authentication middleware. As it needs to read the OpenAPI definition, it needs to have a reference to the app.
 * @param app
 */
export function createAuthMiddleware<H extends AuthenticationGenerics>(
  app: OpenAPIHono<H>,
) {
  return async (ctx: Context, next: Next) => {
    const definition = app.openAPIRegistry.definitions.find(
      (def) =>
        'route' in def &&
        def.route.path === ctx.req.path &&
        def.route.method.toUpperCase() === ctx.req.method,
    );

    if (definition && 'route' in definition) {
      const requiredPermissions = definition.route.security?.[0]?.Bearer;

      if (requiredPermissions) {
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
    }

    return await next();
  };
}
