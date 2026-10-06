import { cache } from "cloudflare:workers";

export const PROJECTS_QUERY_TAG = "projects-query";

/**
 * 企画本体のキャッシュタグを生成する。
 *
 * @param projectId - 企画 ID。タグで使えない文字を避けるため URL エンコードする。
 * @returns `projects-{エンコード済みID}` 形式のタグ。
 */
export const projectCacheTag = (projectId: string): string =>
  `projects-${encodeURIComponent(projectId)}`;

/**
 * 企画詳細情報のキャッシュタグを生成する。
 *
 * @param projectId - URL エンコード前の企画 ID。
 * @returns `projects-{エンコード済みID}-details` 形式のタグ。
 */
export const projectDetailsCacheTag = (projectId: string): string =>
  `${projectCacheTag(projectId)}-details`;

/**
 * 生成済みの ASCII タグが Workers Cache の長さ制限内か判定する。
 *
 * @param tag - 長さを確認するタグ。使用可能な文字かどうかは検証しない。
 * @returns 1024文字以下なら `true`。
 */
export const isCacheableTag = (tag: string): boolean => tag.length <= 1024;

const checkResult = (result: CachePurgeResult): void => {
  if (!result.success) {
    throw new Error(
      `Workers Cache operation failed: ${JSON.stringify(result.errors)}`,
    );
  }
};

const purgeTags = async (tags: string[]): Promise<void> => {
  // ローカル開発など Workers Cache が無効な環境には purge API がない。
  if (typeof cache.purge !== "function") {
    return;
  }
  const cacheableTags = tags.filter(isCacheableTag);
  if (cacheableTags.length > 0) {
    checkResult(await cache.purge({ tags: cacheableTags }));
  }
};

/**
 * `projects-query` タグを持つ一覧キャッシュを stale にして再検証を促す。
 *
 * @remarks
 * DB の変更が成功した後に呼び出す。Workers Cache が無効な環境では何もしない。
 * @returns 無効化の受付後、またはスキップ時に解決する Promise。
 * @throws キャッシュ API の呼び出し、または無効化の受付が失敗した場合。
 */
export const invalidateProjectQueries = async (): Promise<void> => {
  if (typeof cache.purge !== "function") {
    return;
  }
  checkResult(await cache.invalidate({ tags: [PROJECTS_QUERY_TAG] }));
};

/**
 * 企画のキャッシュを削除し、一覧キャッシュを再検証の対象にする。
 *
 * @remarks
 * DB の変更が成功した後に呼び出す。Workers Cache が無効ならスキップする。
 * 長さ制限を超えるタグは purge しない。失敗しても DB の変更は巻き戻さない。
 * @param projectId - 対象企画の ID。
 * @param includeDetails - 詳細キャッシュも削除する場合は `true`。既定値は `false`。
 * @returns purge と一覧の invalidate が両方受け付けられた後に解決する Promise。
 * スキップした操作については受付を待たない。
 * @throws いずれかのキャッシュ操作が失敗した場合。
 */
export const purgeProjectCache = async (
  projectId: string,
  includeDetails = false,
): Promise<void> => {
  await Promise.all([
    purgeTags([
      projectCacheTag(projectId),
      ...(includeDetails ? [projectDetailsCacheTag(projectId)] : []),
    ]),
    invalidateProjectQueries(),
  ]);
};

/**
 * 指定した企画の詳細キャッシュを削除する。
 *
 * @remarks
 * 詳細情報の保存・削除後に呼び出す。Workers Cache が無効な環境や、
 * タグが長さ制限を超える場合は何もしない。
 * @param projectId - 対象企画の ID。
 * @returns purge の受付後、またはスキップ時に解決する Promise。
 * @throws キャッシュ API の呼び出し、または purge の受付が失敗した場合。
 */
export const purgeProjectDetailsCache = async (
  projectId: string,
): Promise<void> => {
  await purgeTags([projectDetailsCacheTag(projectId)]);
};
