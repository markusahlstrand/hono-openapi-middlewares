import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { expect, it } from 'vitest';
import { createAuthMiddleware } from '../src/middlewares/authentication';

it('validates Zod 4 schemas and generates OpenAPI 3.1 with authentication installed', async () => {
  const app = new OpenAPIHono<{ Bindings: { JWKS_URL: string } }>();
  app.use(createAuthMiddleware(app));
  app.openapi(
    createRoute({
      method: 'post',
      path: '/items',
      request: {
        body: {
          content: {
            'application/json': { schema: z.object({ name: z.string() }) },
          },
        },
      },
      responses: {
        200: {
          description: 'Created item',
          content: {
            'application/json': { schema: z.object({ name: z.string() }) },
          },
        },
      },
    }),
    (c) => c.json(c.req.valid('json')),
  );

  const request = (name: unknown) =>
    app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  const valid = await request('Example');
  expect(valid.status).toBe(200);
  expect(await valid.json()).toEqual({ name: 'Example' });
  expect((await request(42)).status).toBe(400);

  const document = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'Test', version: '1.0.0' },
  });
  expect(document.paths?.['/items']?.post?.requestBody).toMatchObject({
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    },
  });
});
