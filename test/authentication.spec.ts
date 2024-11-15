import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';
import { testClient } from 'hono/testing';
import { createAuthMiddleware } from '../src/middlewares/authentication';

interface Bindings {
  JWKS_URL: string;
  JWKS_SERVICE?: {
    fetch: typeof fetch;
  };
}

const token =
  'eyJraWQiOiJrdHlWY0RyZkNOclIxSXEzZkJwb2IiLCJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJkZWZhdWx0Iiwic2NvcGUiOiJvcGVuaWQgZW1haWwgcHJvZmlsZSIsInBlcm1pc3Npb25zIjpbInBvZGNhc3RzOnJlYWQiLCJwb2RjYXN0czp3cml0ZSJdLCJzdWIiOiJhdXRoMHw2MzViZGZkZjFmYWRhNzk1ZTgyYmQwNWQiLCJraWQiOiJrdHlWY0RyZkNOclIxSXEzZkJwb2IiLCJpc3MiOiJodHRwczovL3Rva2VuLnNlc2FteS5kZXYvIiwiYXpwIjoia3ZhcnRhbCIsInZlbmRvcl9pZCI6Imt2YXJ0YWwiLCJpYXQiOjE3MzE1NzIyMjAsImV4cCI6MTczMTY1ODYyMH0.eeKG25sZiOpgHv8EZEawnJVt9NNYJrbqJJqgnUErsDU0H-XGOkaxTGG_cfTU3toFFhtVPmm9unFywh9PuQ-l6ewrZCSOhGwLCalbKo_nUVgUo93PXm98APr8U-YEfl2YsIpb-hLrnYpgK6R9yTVeJKqEAlFzTeFf1Ucl5BvGrluZgEy8EAW1ct-1rfHw7BXFVfFn7oga9o8h-vCY5EPDVHAo9jrTUhZp3DTtYSun1v6kaoqOp5yvr5OWkFkZI9Wv5Ogc7KwrUd7ULExV_fVpcIq078O_u2seNriYVgp3xBcsMvYJsbmWzv8OCsLZcXG18n0E7SUYvh95PR9cXzNgKGSPJVdtrOjMmi11WeYin_qpdIwa63GmhO8z9NbM9TD99WnLAMwcaSTSMvpiVw0ctgU7mGYPnEcrflRT_t169yGg_Ms6kkxptMzGpJI7sskxj6-izL9GYbyNYypOonLdAQGsCjLZzZ5tlNr7o1ucKpBR9zwfZOcBEfeqeahc3rH2y5JlcUE7Ic06ui4hfXk9CLnL-mdm4IALcUJk2XUqAGmTtt-Vf_0SeQFj6cS7kUvprYvXK3hv4WapeN1N1zqsi7cy0GxvwgH5FC_-eTQTTbvL7fnz4nAVDt0t_273N7hrQsh9go3w91mjvBUWt65eztU44C0ctwlBslAtxN0HrUs';

function getTestApp(security: string[] = []) {
  const rootApp = new OpenAPIHono<{
    Bindings: Bindings;
  }>();

  rootApp.use(createAuthMiddleware(rootApp));

  const app = rootApp
    // --------------------------------
    // GET /authenticated
    // --------------------------------
    .openapi(
      createRoute({
        tags: ['test'],
        method: 'get',
        path: '/authenticated',
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
    // --------------------------------
    // GET /unauthenticated
    // --------------------------------
    .openapi(
      createRoute({
        tags: ['test'],
        method: 'get',
        path: '/unauthenticated',
        responses: {
          200: {
            description: 'Status',
          },
        },
      }),
      async (ctx) => {
        return ctx.text('Unauthenticated');
      },
    );

  return testClient(app, {
    JWKS_URL: 'https://example.com',
    JWKS_SERVICE: {
      fetch: async () =>
        new Response(
          JSON.stringify({
            keys: [
              {
                kid: 'ktyVcDrfCNrR1Iq3fBpob',
                alg: 'RS256',
                e: 'AQAB',
                kty: 'RSA',
                n: 'zDsobBekECj41TbpxwLjsEXkCu0BqfAWT15hYhIW4gWsXtb7TqfQLU8MJmaZR_GX4xQ1X5cgcWUh7ZMYDtnU6QSzGz5mRLfq1u0oIq9thdNViuxUHGpdaQRMAYIPwVwtFb1QWQdYq0QYF-M9t20N7dDOxYfGTs03i8dtKvvd2mDHVXtDXfOwdpsRqDzu03OdFMnWQl3nuePz7U44f9owpmZlZcZv03nPCyuHOpCGcNwexeLCcc97eRbgRaZa1_NJ6lzo1WsDx_tyR7cu4LZZpgs0z-KXUaU4sYqiVsz7UM96wNOmRDmFAUIo3m44d5hFWizIaBJ1b6QfT9Xu2GV8eaE8wlSnGMCl_F0GHblpTH9bcfhWfazDscqk3qWj6CMb49L70As96P29_qocs8tBQWlDe9qVh5Bb69wChj62EzDjVY-YMAJnaO3zyVSbRO5Qg6XPj8UYniPcaDpO7l84NNbQzfAk6ZOAwplcMTTvWiQe7EUMUuk0aGQH7uKXO-P2z4k86dnHFS_wjFogizcsbhDSPRRoC-IW__EQewgw0ICO3Vpe5JJ-EgluKPxHzY-ldHWZilOyF_wr9mUXvOhhGtKQsQcXd8FWo92nwM6IqhesljaQA97KlZ_VKE_WODZ94mgb6dD-v06yiWfZeOtBury0veDF30zwILJDTGfTq6k',
                use: 'sig',
              },
            ],
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    },
  });
}

describe('authentication', () => {
  it('A request without a bearer should return a 403', async () => {
    const appClient = getTestApp();

    const response = await appClient.authenticated.$get();

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Missing bearer token');
  });

  it('A request with a invalid bearer should return a 403', async () => {
    const appClient = getTestApp();

    const response = await appClient.authenticated.$get(
      {},
      {
        headers: {
          Authorization: 'Bearer invalid',
        },
      },
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Invalid JWT signature');
  });

  it('A request to a unauthenticated endpoint without a bearer should return a 200', async () => {
    const appClient = getTestApp();

    const response = await appClient.unauthenticated.$get({});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Unauthenticated');
  });

  it('A request with a valid token should return a 200', async () => {
    const appClient = getTestApp();

    const response = await appClient.authenticated.$get(
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Hello World');
  });

  it('A request with a valid token and matching permission should return a 200', async () => {
    const appClient = getTestApp(['podcasts:read', 'some:other:scope']);

    const response = await appClient.authenticated.$get(
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Hello World');
  });

  it('A request with a valid token and non-matching permission should return a 403', async () => {
    const appClient = getTestApp(['some:other:scope']);

    const response = await appClient.authenticated.$get(
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Unauthorized');
  });
});
