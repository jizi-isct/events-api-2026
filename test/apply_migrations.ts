import { applyD1Migrations, env } from "cloudflare:test";
import { vi } from "vitest";

// Workers Cache のグローバル操作はローカルの workerd では再現できない。
// ルートテストは呼び出しを検証し、実際の HIT / purge はデプロイ先で確認する。
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: {
    purge: vi.fn(async () => ({ success: true, errors: [] })),
    invalidate: vi.fn(async () => ({ success: true, errors: [] })),
  },
}));

// setupFiles での書き込みは各テストの初期状態として保存され、テストごとの
// 変更はそのスナップショットまで巻き戻る(isolatedStorage)。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
