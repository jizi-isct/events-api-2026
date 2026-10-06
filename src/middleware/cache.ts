import type { Context } from "hono";
import { etag } from "hono/etag";
import { createMiddleware } from "hono/factory";
import type { Bindings } from "../bindings";
import { isCacheableTag } from "../services/project_cache";

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const revalidate = etag();

/**
 * キャッシュ方針が未指定の応答とエラー応答に `no-store` を設定する。
 *
 * @remarks
 * Workers Cache の暗黙の保存を防ぐため、ルートより先に登録する。
 * 成功応答の既存の Cache-Control は維持し、エラー応答の Cache-Tag は削除する。
 * @param c - Hono のリクエストコンテキスト。
 * @param next - 後続のミドルウェアとルートハンドラを実行する関数。
 * @returns 後続処理とヘッダ設定の完了時に解決する Promise。
 */
export const defaultNoStore = createMiddleware(async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control") || c.res.status >= 400) {
    c.header("Cache-Control", "no-store");
  }
  if (c.res.status >= 400) {
    c.res.headers.delete("Cache-Tag");
  }
});

/**
 * 成功応答を Workers Cache に24時間保存するミドルウェアを生成する。
 *
 * @remarks
 * 200応答にタグと ETag を付け、条件付きリクエストで未変更なら304を返す。
 * ブラウザは毎回再確認させる。200以外の応答や長すぎるタグは対象外にするため、
 * 保存しない場合の既定方針として {@link defaultNoStore} と併用する。
 * @param tag - 固定のタグ、またはリクエストコンテキストからタグを生成する関数。
 * @returns キャッシュ用ヘッダの設定と ETag の再検証を行う Hono ミドルウェア。
 */
export const cacheResponse = (
  tag: string | ((c: Context<{ Bindings: Bindings }, "/:projectId">) => string),
) =>
  createMiddleware<{ Bindings: Bindings }, "/:projectId">(async (c, next) => {
    await next();
    const response = c.res;
    if (response.status !== 200) {
      return;
    }

    const cacheTag = typeof tag === "string" ? tag : tag(c);
    // 上限を超えるタグは Cloudflare が破棄するため、その応答は保存しない。
    if (!isCacheableTag(cacheTag)) {
      return;
    }

    // invalidate 後、内容が同じなら 304 でキャッシュの再利用を許可する。
    const responseHeaders = response.headers;
    await revalidate(c, async () => {});
    // Hono の etag は 304 の Response を作り直すため、CORS ヘッダを戻す。
    if (c.res.status === 304) {
      for (const [name, value] of responseHeaders) {
        if (name === "vary" || name.startsWith("access-control-")) {
          c.header(name, value);
        }
      }
    }
    // ブラウザのキャッシュは purge できないため、毎回 edge へ再確認させる。
    c.header(
      "Cache-Control",
      `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, must-revalidate`,
    );
    c.header("Cache-Tag", cacheTag);
  });
