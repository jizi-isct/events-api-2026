import * as v from "valibot";
import {
  type Category,
  type Project,
  type ProjectId,
  type ProjectType,
  ProjectSchema,
} from "../models";

/** 企画が見つからなかったことを表す。 */
export class ProjectNotFoundError extends Error {
  constructor(readonly projectId: ProjectId) {
    super(`Project not found: ${projectId}`);
    this.name = "ProjectNotFoundError";
  }
}

interface ProjectRow {
  id: string;
  type: ProjectType;
  group_name: string;
  project_name: string;
  description: string;
  is_child_friendly: number;
  is_recommended: number;
  category: Category | null;
  is_tour: number | null;
}

interface TagRow {
  project_id: string;
  tag: string;
  tag2: string | null;
}

interface OccasionRow {
  project_id: string;
  place_id: string | null;
  start_date: number;
  start_hour: number;
  start_minute: number;
  end_date: number;
  end_hour: number;
  end_minute: number;
}

const SELECT_PROJECT_COLUMNS = `
  id, type, group_name, project_name, description,
  is_child_friendly, is_recommended, category, is_tour
`;

const SELECT_TAG_COLUMNS = `project_id, tag, tag2`;

const SELECT_OCCASION_COLUMNS = `
  project_id, place_id,
  start_date, start_hour, start_minute,
  end_date, end_hour, end_minute
`;

const INSERT_PROJECT = `
  INSERT INTO projects (
    id, type, group_name, project_name, description,
    is_child_friendly, is_recommended, category, is_tour
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_PROJECT = `
  UPDATE projects SET
    type = ?, group_name = ?, project_name = ?, description = ?,
    is_child_friendly = ?, is_recommended = ?, category = ?, is_tour = ?
  WHERE id = ?
`;

const INSERT_TAG = `
  INSERT INTO project_tags (project_id, position, tag, tag2) VALUES (?, ?, ?, ?)
`;

const INSERT_OCCASION = `
  INSERT INTO project_occasions (
    project_id, position, place_id,
    start_date, start_hour, start_minute,
    end_date, end_hour, end_minute
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/** 種別ごとの列。laboratory 以外では NULL(マイグレーションの CHECK と対応)。 */
const isTourColumn = (project: Project): number | null =>
  project.type === "laboratory" ? Number(project.isTour) : null;

const groupByProjectId = <T extends { project_id: string }>(
  rows: T[],
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const rowsOfProject = grouped.get(row.project_id);

    if (rowsOfProject === undefined) {
      grouped.set(row.project_id, [row]);
    } else {
      rowsOfProject.push(row);
    }
  }

  return grouped;
};

/**
 * 行を {@link Project} に組み立てる。
 * DB 上のタグは type によって解釈が変わる(general は文字列、food-stall は
 * tag / tag2 の二段構造)ため、type で分岐してから ProjectSchema で検証する。
 * 検証を挟むのは、place_id など DB 側で制約を張れない値があるため。
 */
const toProject = (
  row: ProjectRow,
  tagRows: TagRow[],
  occasionRows: OccasionRow[],
): Project => {
  const project: Record<string, unknown> = {
    id: row.id,
    type: row.type,
    groupName: row.group_name,
    projectName: row.project_name,
    description: row.description,
    isChildFriendly: row.is_child_friendly === 1,
    isRecommended: row.is_recommended === 1,
    // 任意の項目。DB の NULL はキーごと落として undefined に揃える。
    category: row.category ?? undefined,
    occasions: occasionRows.map((occasion) => ({
      // place は任意。DB の NULL はキーごと落として undefined に揃える。
      place: occasion.place_id ?? undefined,
      timeRange: {
        start: {
          date: occasion.start_date,
          hour: occasion.start_hour,
          minute: occasion.start_minute,
        },
        end: {
          date: occasion.end_date,
          hour: occasion.end_hour,
          minute: occasion.end_minute,
        },
      },
    })),
  };

  switch (row.type) {
    case "general":
      project.tag = tagRows.map((tagRow) => tagRow.tag);
      break;
    case "food-stall":
      project.tag = tagRows.map((tagRow) =>
        tagRow.tag2 === null
          ? { tag: tagRow.tag }
          : { tag: tagRow.tag, tag2: tagRow.tag2 },
      );
      break;
    case "laboratory":
      project.isTour = row.is_tour === 1;
      break;
    case "stage":
      break;
  }

  return v.parse(ProjectSchema, project);
};

/**
 * 企画の永続化を担う。
 * 一つの企画は projects / project_tags / project_occasions の三つの表に
 * またがるため、書き込みはすべて {@link D1Database.batch}(単一トランザクション)
 * で行い、途中で失敗したときに中途半端な状態が残らないようにしている。
 */
export class ProjectRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * 企画を新規登録する。
   * @throws 同じ id の企画が既にある場合。
   */
  async create(project: Project): Promise<void> {
    await this.db.batch(this.insertStatements(project));
  }

  /**
   * 複数の企画をまとめて新規登録する。
   * batch は単一トランザクションなので、一件でも失敗すれば一件も入らない。
   * @throws 既にある id が含まれる場合。
   */
  async createMany(projects: Project[]): Promise<void> {
    if (projects.length === 0) {
      return;
    }

    await this.db.batch(
      projects.flatMap((project) => this.insertStatements(project)),
    );
  }

  /** 渡した id のうち、既に登録されているものを返す。 */
  async findExistingIds(projectIds: ProjectId[]): Promise<ProjectId[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const placeholders = projectIds.map(() => "?").join(", ");
    const result = await this.db
      .prepare(`SELECT id FROM projects WHERE id IN (${placeholders})`)
      .bind(...projectIds)
      .all();

    return (result.results as { id: string }[]).map((row) => row.id);
  }

  /** 企画を一件取得する。存在しなければ null を返す。 */
  async get(projectId: ProjectId): Promise<Project | null> {
    const [projectResult, tagResult, occasionResult] = await this.db.batch([
      this.db
        .prepare(`SELECT ${SELECT_PROJECT_COLUMNS} FROM projects WHERE id = ?`)
        .bind(projectId),
      this.db
        .prepare(
          `SELECT ${SELECT_TAG_COLUMNS} FROM project_tags
           WHERE project_id = ? ORDER BY position`,
        )
        .bind(projectId),
      this.db
        .prepare(
          `SELECT ${SELECT_OCCASION_COLUMNS} FROM project_occasions
           WHERE project_id = ? ORDER BY position`,
        )
        .bind(projectId),
    ]);

    const row = (projectResult.results as ProjectRow[])[0];

    if (row === undefined) {
      return null;
    }

    return toProject(
      row,
      tagResult.results as TagRow[],
      occasionResult.results as OccasionRow[],
    );
  }

  /** 企画を全件取得する。 */
  async list(): Promise<Project[]> {
    // 企画ごとに子を引くと N+1 になるため、三つの表をまとめて読んで
    // メモリ上で企画ごとに束ね直す。
    const [projectResult, tagResult, occasionResult] = await this.db.batch([
      this.db.prepare(
        `SELECT ${SELECT_PROJECT_COLUMNS} FROM projects ORDER BY id`,
      ),
      this.db.prepare(
        `SELECT ${SELECT_TAG_COLUMNS} FROM project_tags
         ORDER BY project_id, position`,
      ),
      this.db.prepare(
        `SELECT ${SELECT_OCCASION_COLUMNS} FROM project_occasions
         ORDER BY project_id, position`,
      ),
    ]);

    const tagsByProjectId = groupByProjectId(tagResult.results as TagRow[]);
    const occasionsByProjectId = groupByProjectId(
      occasionResult.results as OccasionRow[],
    );

    return (projectResult.results as ProjectRow[]).map((row) =>
      toProject(
        row,
        tagsByProjectId.get(row.id) ?? [],
        occasionsByProjectId.get(row.id) ?? [],
      ),
    );
  }

  /**
   * 企画を更新する。タグと occasion は差分ではなく総入れ替えする。
   * @throws {ProjectNotFoundError} 対象の企画が存在しない場合。
   */
  async update(project: Project): Promise<void> {
    // 対象が存在しない場合、タグや occasion があれば子の INSERT が外部キー違反に
    // なり、なければ何も起きずに成功してしまう。失敗の仕方が企画の中身によって
    // 変わらないよう、batch の前に存在を確かめる。
    const existing = await this.db
      .prepare(`SELECT 1 FROM projects WHERE id = ?`)
      .bind(project.id)
      .first();

    if (existing === null) {
      throw new ProjectNotFoundError(project.id);
    }

    const [updateResult] = await this.db.batch([
      this.db
        .prepare(UPDATE_PROJECT)
        .bind(
          project.type,
          project.groupName,
          project.projectName,
          project.description,
          Number(project.isChildFriendly),
          Number(project.isRecommended),
          project.category ?? null,
          isTourColumn(project),
          project.id,
        ),
      this.db
        .prepare(`DELETE FROM project_tags WHERE project_id = ?`)
        .bind(project.id),
      this.db
        .prepare(`DELETE FROM project_occasions WHERE project_id = ?`)
        .bind(project.id),
      ...this.tagStatements(project),
      ...this.occasionStatements(project),
    ]);

    // 上の存在確認と batch の間に削除された場合の保険。
    if (updateResult.meta.changes === 0) {
      throw new ProjectNotFoundError(project.id);
    }
  }

  /**
   * 企画の説明だけを書き換える。他の列・タグ・occasion には触れない。
   * @throws {ProjectNotFoundError} 対象の企画が存在しない場合。
   */
  async updateDescription(
    projectId: ProjectId,
    description: string,
  ): Promise<void> {
    const result = await this.db
      .prepare(`UPDATE projects SET description = ? WHERE id = ?`)
      .bind(description, projectId)
      .run();

    if (result.meta.changes === 0) {
      throw new ProjectNotFoundError(projectId);
    }
  }

  /**
   * 企画を削除する。タグと occasion は ON DELETE CASCADE で一緒に消える。
   * @throws {ProjectNotFoundError} 対象の企画が存在しない場合。
   */
  async delete(projectId: ProjectId): Promise<void> {
    const result = await this.db
      .prepare(`DELETE FROM projects WHERE id = ?`)
      .bind(projectId)
      .run();

    if (result.meta.changes === 0) {
      throw new ProjectNotFoundError(projectId);
    }
  }

  /** 企画一件を三つの表へ書き込む文。呼び出し側で一つの batch にまとめる。 */
  private insertStatements(project: Project): D1PreparedStatement[] {
    return [
      this.db
        .prepare(INSERT_PROJECT)
        .bind(
          project.id,
          project.type,
          project.groupName,
          project.projectName,
          project.description,
          Number(project.isChildFriendly),
          Number(project.isRecommended),
          project.category ?? null,
          isTourColumn(project),
        ),
      ...this.tagStatements(project),
      ...this.occasionStatements(project),
    ];
  }

  private tagStatements(project: Project): D1PreparedStatement[] {
    if (project.type !== "general" && project.type !== "food-stall") {
      return [];
    }

    const insert = this.db.prepare(INSERT_TAG);
    // general の GeneralTag は文字列、food-stall の FoodStallTag は
    // tag / tag2 を持つオブジェクト。どちらも (tag, tag2) の行に落とす。
    const tags: (Project & {
      type: "general" | "food-stall";
    })["tag"][number][] = project.tag;

    return tags.map((tag, position) =>
      typeof tag === "string"
        ? insert.bind(project.id, position, tag, null)
        : insert.bind(
            project.id,
            position,
            tag.tag,
            "tag2" in tag ? tag.tag2 : null,
          ),
    );
  }

  private occasionStatements(project: Project): D1PreparedStatement[] {
    const insert = this.db.prepare(INSERT_OCCASION);

    return project.occasions.map((occasion, position) =>
      insert.bind(
        project.id,
        position,
        // place は任意。D1 の bind は undefined を受け付けないため null に寄せる。
        occasion.place ?? null,
        occasion.timeRange.start.date,
        occasion.timeRange.start.hour,
        occasion.timeRange.start.minute,
        occasion.timeRange.end.date,
        occasion.timeRange.end.hour,
        occasion.timeRange.end.minute,
      ),
    );
  }
}
