/**
 * ルーティングが必要とするバインディング。
 * wrangler.jsonc の staging / prod どちらの環境もこれを満たす。
 * 生成される Cloudflare.Env ではトップレベル設定に D1 が無いため
 * DB が optional になるので、必要な形をここで明示する。
 */
export type Bindings = {
  DB: D1Database;
  /** 企画アイコンの原本を保存する R2 bucket。 */
  ICON_BUCKET: R2Bucket;
  /** 画像の形式・寸法判定と最適化に使う Cloudflare Images binding。 */
  IMAGES: ImagesBinding;
  /** Access チームのドメイン(例: https://example.cloudflareaccess.com)。 */
  ACCESS_TEAM_DOMAIN: string;
  /** ホストのルート保護用 Access application の Audience (AUD) タグ。 */
  ACCESS_AUD: string;
  /**
   * ローカル開発で Access の検証を迂回するためのフラグ。
   * .dev.vars でのみ設定し、デプロイ先には存在しない。
   */
  ACCESS_DEV_BYPASS?: string;
};
