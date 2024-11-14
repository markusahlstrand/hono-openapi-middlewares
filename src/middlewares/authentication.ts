import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

export interface Fetcher {
  fetch: typeof fetch;
}

export interface AuthBindings {
  JWKS_URL: string;
  JWKS_SERVICE: Fetcher;
  JWKS_CACHE_TIMEOUT_IN_SECONDS?: number;
}

const jwksKeySchema = z.object({
  alg: z.literal("RS256"),
  kty: z.literal("RSA"),
  use: z.literal("sig"),
  n: z.string(),
  e: z.string(),
  kid: z.string(),
  x5t: z.string().optional(),
  x5c: z.array(z.string()).optional(),
});

interface TokenData {
  header: {
    alg: string;
    typ: string;
    kid: string;
  };
  payload: {
    sub: string;
    iss: string;
    aud: string[];
    iat: number;
    exp: number;
    scope: string;
    permissions?: string[];
    azp?: string;
  };
  signature: string;
  raw: {
    header: string;
    payload: string;
    signature: string;
  };
}

async function getJwks(bindings: AuthBindings) {
  try {
    const response = await bindings.JWKS_SERVICE.fetch(bindings.JWKS_URL);

    if (!response.ok) {
      throw new Error("Failed to fetch jwks");
    }

    const responseBody = await response.json();

    return z.array(jwksKeySchema).parse(responseBody.keys);
  } catch (err) {
    const error = err as Error;
    throw new HTTPException(500, {
      message:
        "Failed to fetch jwks: " +
        error.message +
        ", " +
        JSON.stringify(bindings),
    });
  }
}

async function isValidJwtSignature(ctx: Context, token: TokenData) {
  const encoder = new TextEncoder();
  const data = encoder.encode([token.raw.header, token.raw.payload].join("."));
  const signature = new Uint8Array(
    Array.from(token.signature).map((c) => c.charCodeAt(0))
  );
  const jwksKeys = await getJwks(ctx.env);

  const jwksKey = jwksKeys.find((key) => key.kid === token.header.kid);

  if (!jwksKey) {
    console.log("No matching kid found");
    return false;
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwksKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
}

/**
 * Parse and decode a JWT.
 * A JWT is three, base64 encoded, strings concatenated with ‘.’:
 *   a header, a payload, and the signature.
 * The signature is “URL safe”, in that ‘/+’ characters have been replaced by ‘_-’
 *
 * Steps:
 * 1. Split the token at the ‘.’ character
 * 2. Base64 decode the individual parts
 * 3. Retain the raw Bas64 encoded strings to verify the signature
 */
function decodeJwt(token: string): TokenData | null {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) {
    return null;
  }

  const header = JSON.parse(atob(h));
  const payload = JSON.parse(atob(p));
  const signature = atob(s.replace(/-/g, "+").replace(/_/g, "/"));

  return {
    header,
    payload,
    signature,
    raw: { header: h, payload: p, signature: s },
  };
}

/**
 * This registeres the authentication middleware. As it needs to read the OpenAPI definition, it needs to have a reference to the app.
 * @param app
 */
export function createAuthMiddleware<B extends AuthBindings = AuthBindings>(
  app: OpenAPIHono<{ Bindings: B }>
) {
  return async (ctx: Context, next: Next) => {
    const definition = app.openAPIRegistry.definitions.find(
      (def) =>
        "route" in def &&
        def.route.path === ctx.req.path &&
        def.route.method.toUpperCase() === ctx.req.method
    );

    if (definition && "route" in definition) {
      const requiredPermissions = definition.route.security?.[0]?.Bearer;

      const authHeader = ctx.req.header("authorization") || "";
      const [authType, bearer] = authHeader.split(" ");
      if (authType?.toLowerCase() !== "bearer" || !bearer) {
        throw new HTTPException(403, {
          message: "Missing bearer token",
        });
      }

      const token = decodeJwt(bearer);

      if (!token || !(await isValidJwtSignature(ctx, token))) {
        throw new HTTPException(403, { message: "Invalid JWT signature" });
      }

      ctx.set("user_id", token.payload.sub);

      const permissions = token.payload.permissions || [];
      if (
        requiredPermissions?.length &&
        !requiredPermissions.some((scope) => permissions.includes(scope))
      ) {
        throw new HTTPException(403, { message: "Unauthorized" });
      }
    }

    return await next();
  };
}
