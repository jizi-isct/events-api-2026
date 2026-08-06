import fs from "node:fs/promises";
import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { TEST_ACCESS_AUD, TEST_ACCESS_TEAM_DOMAIN } from "./test/access_config";

// マイグレーションを読み込んでおき、setupFiles でテスト用 D1 に適用する。
// 本番と同じ migrations/ を使うので、スキーマとテストがずれない。
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "migrations"),
);

// 開発用の迂回フラグがデプロイされる設定に混入していないかテストで検査する。
const wranglerConfig = await fs.readFile(
  path.join(import.meta.dirname, "wrangler.jsonc"),
  "utf8",
);

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        r2Buckets: ["TEST_ICON_BUCKET"],
        bindings: {
          TEST_MIGRATIONS: migrations,
          TEST_WRANGLER_CONFIG: wranglerConfig,
          // Access の検証はテスト内で JWKS エンドポイントをスタブして行う。
          ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM_DOMAIN,
          ACCESS_AUD: TEST_ACCESS_AUD,
          // vitest-pool-workers は .dev.vars も読むため、開発者が
          // 迂回フラグを立てていると認証のテストが素通りしてしまう。打ち消す。
          ACCESS_DEV_BYPASS: "",
        },
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
