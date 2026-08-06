/**
 * テスト用の Access 設定。
 * vitest.config.ts がバインディングとして注入し、テストは同じ値で JWT を署名する。
 * wrangler types は vars をリテラル型として生成してしまうため、
 * テストからは env 経由ではなくここを参照する。
 */
export const TEST_ACCESS_TEAM_DOMAIN = "https://test.cloudflareaccess.com";
export const TEST_ACCESS_AUD = "test-aud";
