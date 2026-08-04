import { applyD1Migrations, env } from "cloudflare:test";

// setupFiles での書き込みは各テストの初期状態として保存され、テストごとの
// 変更はそのスナップショットまで巻き戻る(isolatedStorage)。
await applyD1Migrations(env.events_api_2026_staging, env.TEST_MIGRATIONS);
