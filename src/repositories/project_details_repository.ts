import * as v from "valibot";
import {
  type ProjectDetails,
  ProjectDetailsSchema,
  type ProjectId,
} from "../models";

interface ProjectDetailsRow {
  additional_info: string | null;
  menu: string | null;
}

const SAVE_PROJECT_DETAILS = `
  INSERT INTO project_details (project_id, additional_info, menu)
  VALUES (?, ?, ?)
  ON CONFLICT (project_id) DO UPDATE SET
    additional_info = excluded.additional_info,
    menu = excluded.menu
`;

/** D1 の一行を ProjectDetails に組み立て、モデルとして再検証する。 */
const toProjectDetails = (row: ProjectDetailsRow): ProjectDetails => {
  const details: Record<string, unknown> = {};

  if (row.additional_info !== null) {
    details.additionalInfo = row.additional_info;
  }

  if (row.menu !== null) {
    details.menu = JSON.parse(row.menu);
  }

  return v.parse(ProjectDetailsSchema, details);
};

/** 企画詳細情報の永続化を担う。 */
export class ProjectDetailsRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * 企画詳細情報を保存する。同じ企画 ID の情報があれば丸ごと置き換える。
   * @throws 対応する企画が存在しない場合。
   */
  async save(projectId: ProjectId, details: ProjectDetails): Promise<void> {
    await this.db
      .prepare(SAVE_PROJECT_DETAILS)
      .bind(
        projectId,
        details.additionalInfo ?? null,
        details.menu === undefined ? null : JSON.stringify(details.menu),
      )
      .run();
  }

  /** 企画詳細情報を一件取得する。存在しなければ null を返す。 */
  async get(projectId: ProjectId): Promise<ProjectDetails | null> {
    const row = await this.db
      .prepare(
        `SELECT additional_info, menu
         FROM project_details
         WHERE project_id = ?`,
      )
      .bind(projectId)
      .first<ProjectDetailsRow>();

    return row === null ? null : toProjectDetails(row);
  }
}
