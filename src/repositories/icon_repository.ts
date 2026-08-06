import type { ProjectId } from "../models";

/** R2 上で企画アイコンの原本を保存するキー。 */
const originalIconKey = (projectId: ProjectId): string =>
  `${projectId}/original`;

/** 企画アイコンの永続化を担う。 */
export class IconRepository {
  constructor(private readonly bucket: R2Bucket) {}

  /** 企画 ID に対応するアイコンの原本を取得する。 */
  get(projectId: ProjectId): Promise<R2ObjectBody | null>;
  get(
    projectId: ProjectId,
    onlyIf: Headers,
  ): Promise<R2ObjectBody | R2Object | null>;
  async get(
    projectId: ProjectId,
    onlyIf?: Headers,
  ): Promise<R2ObjectBody | R2Object | null> {
    const key = originalIconKey(projectId);

    return onlyIf === undefined
      ? this.bucket.get(key)
      : this.bucket.get(key, { onlyIf });
  }

  /**
   * アイコンの原本を保存する。同じ企画 ID のアイコンがあれば上書きする。
   * Content-Type は配信時に復元できるよう R2 の HTTP metadata に保持する。
   */
  async save(projectId: ProjectId, icon: Blob): Promise<void> {
    await this.bucket.put(originalIconKey(projectId), icon, {
      httpMetadata: { contentType: icon.type },
    });
  }

  /** 企画 ID に対応するアイコンの原本を削除する。未登録の場合も成功する。 */
  async delete(projectId: ProjectId): Promise<void> {
    await this.bucket.delete(originalIconKey(projectId));
  }
}
