import type { ProjectId } from "../models";

/** R2 上で企画アイコンの原本を保存するキー。 */
const originalIconKey = (projectId: ProjectId): string =>
  `${projectId}/original`;

/** 企画アイコンの永続化を担う。 */
export class IconRepository {
  constructor(private readonly bucket: R2Bucket) {}

  /**
   * アイコンの原本を保存する。同じ企画 ID のアイコンがあれば上書きする。
   * Content-Type は配信時に復元できるよう R2 の HTTP metadata に保持する。
   */
  async save(projectId: ProjectId, icon: Blob): Promise<void> {
    await this.bucket.put(originalIconKey(projectId), icon, {
      httpMetadata: { contentType: icon.type },
    });
  }
}
