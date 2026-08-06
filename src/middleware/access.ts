import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Bindings } from "../bindings";

/** Access が認証済みリクエストに付ける JWT のヘッダ。 */
const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

/**
 * 認証を迂回するときに ACCESS_DEV_BYPASS に入れる値。
 * 真偽値ではなくこの文字列を要求するのは、うっかり有効にしにくくするため。
 */
export const DEV_BYPASS_VALUE = "local-development-only";

// createRemoteJWKSet は取得した鍵を自身でキャッシュするので、
// リクエストごとに作り直すと毎回 JWKS を取りに行くことになる。
const jwkSets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const getJwkSet = (teamDomain: string) => {
  const cached = jwkSets.get(teamDomain);

  if (cached !== undefined) {
    return cached;
  }

  const jwkSet = createRemoteJWKSet(
    new URL(`${teamDomain}/cdn-cgi/access/certs`),
  );
  jwkSets.set(teamDomain, jwkSet);

  return jwkSet;
};

/**
 * Cloudflare Access が発行した JWT を検証する。
 *
 * Access はエッジでも検査するが、Access アプリの対象外の経路
 * (workers.dev など)から直接叩かれるとその検査を通らない。
 * ここで検証することで、経路によらず認証を必須にする。
 *
 * service token でもユーザーの SSO でも同じヘッダに JWT が入るため、
 * どちらもこの検証を通る。
 *
 * Access はエッジのサービスなので wrangler dev には介在せず、ローカルでは
 * 誰も JWT を発行できない。開発時は .dev.vars で迂回できるようにしてある。
 */
export const requireAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    // .dev.vars は wrangler dev だけが読み、wrangler deploy では送られない。
    // 「ローカルからのリクエストか」で守ろうとしても、wrangler dev は設定上の
    // ホスト名(events26-staging.koudaisai.jp など)をそのまま見せるため
    // 判別できない。デプロイされないこと自体が担保になっている。
    if (c.env.ACCESS_DEV_BYPASS === DEV_BYPASS_VALUE) {
      console.warn(
        "Cloudflare Access verification bypassed. This must never happen in a deployed environment.",
      );
      await next();
      return;
    }

    const token = c.req.header(ACCESS_JWT_HEADER);

    if (token === undefined) {
      return c.json({ message: "Missing Cloudflare Access token" }, 401);
    }

    try {
      await jwtVerify(token, getJwkSet(c.env.ACCESS_TEAM_DOMAIN), {
        issuer: c.env.ACCESS_TEAM_DOMAIN,
        audience: c.env.ACCESS_AUD,
      });
    } catch {
      // 失敗の理由(署名不正・期限切れ・aud 不一致)は呼び出し元に伝えない。
      return c.json({ message: "Invalid Cloudflare Access token" }, 401);
    }

    await next();
  },
);
