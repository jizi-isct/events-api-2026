import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// マイグレーションを読み込んでおき、setupFiles でテスト用 D1 に適用する。
// 本番と同じ migrations/ を使うので、スキーマとテストがずれない。
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "migrations"),
);

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: { TEST_MIGRATIONS: migrations },
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
        environment: "staging",
      },
    }),
  ],
  test: {
    setupFiles: ["./test/apply_migrations.ts"],
  },
});
