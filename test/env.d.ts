import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      // wrangler.jsonc の staging 環境で動かすため、このバインディングは必ずある。
      // 生成された型では全環境共通で optional になっている。
      events_api_2026_staging: D1Database;
      /** vitest.config.ts で注入される、migrations/ の内容。 */
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
