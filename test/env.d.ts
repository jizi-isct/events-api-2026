import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      // テストは wrangler.jsonc の staging 環境で動かすため、必ず存在する。
      // 生成された型ではトップレベル設定に D1 が無いため optional になっている。
      DB: D1Database;
      /** IconRepository のテストに使うローカル R2 bucket。 */
      TEST_ICON_BUCKET: R2Bucket;
      /** vitest.config.ts で注入される、migrations/ の内容。 */
      TEST_MIGRATIONS: D1Migration[];
      /** vitest.config.ts で注入される、wrangler.jsonc の中身。 */
      TEST_WRANGLER_CONFIG: string;
    }
  }
}
