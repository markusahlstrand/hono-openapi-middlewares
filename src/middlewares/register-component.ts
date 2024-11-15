import { OpenAPIHono } from '@hono/zod-openapi';
import { Context, Next } from 'hono';

let initiated = false;

/**
+ * Generic type for OpenAPIHono application with authentication URL binding.
+ */
export type RegisterComponentGenerics = {
  Bindings: {
    AUTH_URL: string;
  };
  Variables?: object;
};

/**
 * This registers the security scheme for the application. As it uses an environment variable, it can only be registered once the first request arrives.
 * @param app
 */
export function registerComponent<H extends RegisterComponentGenerics>(
  app: OpenAPIHono<H>,
) {
  return async (ctx: Context<H>, next: Next) => {
    if (!initiated) {
      app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
        type: 'oauth2',
        scheme: 'bearer',
        flows: {
          implicit: {
            authorizationUrl: ctx.env.AUTH_URL,
            scopes: {
              openid: 'Basic user information',
              email: 'User email',
              profile: 'User profile information',
            },
          },
        },
      });

      initiated = true;
    }

    return await next();
  };
}
