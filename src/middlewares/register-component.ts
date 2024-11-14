import { OpenAPIHono } from '@hono/zod-openapi';
import { Context, Next } from 'hono';

let inititated = false;

export type RegisterComponentGenerics = {
  Bindings: {
    AUTH_URL: string;
  };
  Variables?: object;
};

export type RegisterComponentParams = {
  type: string;
  scheme: string;
  flows: object;
};

/**
 * This registers the security scheme for the application. As it uses an environment variable, it can only be registered once the first request arrives.
 * @param app
 */
export function registerComponent<H extends RegisterComponentGenerics>(
  app: OpenAPIHono<H>,
) {
  app.use(async (ctx: Context<H>, next: Next) => {
    if (!inititated) {
      app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
        type: 'oauth2',
        scheme: 'bearer',
        flows: {
          implicit: {
            authorizationUrl: `${ctx.env.AUTH_URL}/authorize`,
            scopes: {
              openid: 'Basic user information',
              email: 'User email',
              profile: 'User profile information',
            },
          },
        },
      });

      inititated = true;
    }

    return await next();
  });
}
