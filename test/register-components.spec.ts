import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';
import { testClient } from 'hono/testing';
import { registerComponent } from '../src/middlewares/register-component';

interface Bindings {
  AUTH_URL: string;
}

function getTestApp(security: string[] = []) {
  const rootApp = new OpenAPIHono<{
    Bindings: Bindings;
  }>();

  rootApp.use(registerComponent(rootApp));

  const app = rootApp
    // --------------------------------
    // GET /
    // --------------------------------
    .openapi(
      createRoute({
        tags: ['test'],
        method: 'get',
        path: '/',
        security: [
          {
            Bearer: security,
          },
        ],
        responses: {
          200: {
            description: 'Status',
          },
        },
      }),
      async (ctx) => {
        return ctx.text('Hello World');
      },
    )
    .doc('/spec', (c) => ({
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'API',
      },
      servers: [
        {
          url: new URL(c.req.url).origin,
          description: 'Current environment',
        },
      ],
    }));

  return testClient(app, {
    AUTH_URL: 'https://example.com/authorize',
  });
}

describe('registerComponents', () => {
  it('Should add the securitySchema to the ', async () => {
    const appClient = getTestApp();

    const response = await appClient.spec.$get();

    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec: any = await response.json();

    expect(spec.components.securitySchemes).toEqual({
      Bearer: {
        type: 'oauth2',
        scheme: 'bearer',
        flows: {
          implicit: {
            authorizationUrl: 'https://example.com/authorize',
            scopes: {
              openid: 'Basic user information',
              email: 'User email',
              profile: 'User profile information',
            },
          },
        },
      },
    });
  });
});
