import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import type { Occasion, Project, ProjectType } from "../models";
import { ProjectNotFoundError, ProjectRepository } from "./project_repository";

/**
 * Project は base と variant の直和型なので、そのままでは種別ごとの
 * フィールドを扱えない。type で絞った形を取り出す。
 */
type ProjectOf<T extends ProjectType> = Project & { type: T };

const db = env.events_api_2026_staging;

let repository: ProjectRepository;

// storage の分離はテストファイル単位で、ファイル内のテストは DB を共有する。
// テストごとに空の状態から始められるよう明示的に消す(子は CASCADE で消える)。
beforeEach(async () => {
  await db.prepare(`DELETE FROM projects`).run();
  repository = new ProjectRepository(db);
});

const occasionAt = (place: Occasion["place"], hour: number): Occasion => ({
  place,
  timeRange: {
    start: { date: 1, hour, minute: 0 },
    end: { date: 1, hour: hour + 1, minute: 30 },
  },
});

const general = (
  overrides: Partial<ProjectOf<"general">> = {},
): ProjectOf<"general"> => ({
  id: "g1",
  type: "general",
  groupName: "サークルA",
  projectName: "ミニ実験教室",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [occasionAt("south.s3.s3-206", 10)],
  tag: ["experience", "display"],
  ...overrides,
});

const foodStall = (
  overrides: Partial<ProjectOf<"food-stall">> = {},
): ProjectOf<"food-stall"> => ({
  id: "f1",
  type: "food-stall",
  groupName: "サークルB",
  projectName: "手作りクレープ",
  description: "説明",
  isChildFriendly: false,
  isRecommended: true,
  occasions: [occasionAt("east.fs-east-icho.1", 11)],
  tag: [{ tag: "sweet", tag2: "cold" }, { tag: "drink" }],
  ...overrides,
});

const laboratory = (
  overrides: Partial<ProjectOf<"laboratory">> = {},
): ProjectOf<"laboratory"> => ({
  id: "l1",
  type: "laboratory",
  groupName: "研究室C",
  projectName: "ロボティクス研究室公開",
  description: "説明",
  isChildFriendly: true,
  isRecommended: true,
  occasions: [occasionAt("west.lecture-hall-70", 13)],
  isTour: true,
  ...overrides,
});

const stage = (
  overrides: Partial<ProjectOf<"stage">> = {},
): ProjectOf<"stage"> => ({
  id: "s1",
  type: "stage",
  groupName: "サークルD",
  projectName: "ダンスステージ",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [occasionAt("east.wood-deck", 15)],
  ...overrides,
});

/** 型は通るが DB の CHECK に違反する occasion(終了が開始より前)。 */
const invalidOccasion: Occasion = {
  place: "south.s3.s3-206",
  timeRange: {
    start: { date: 2, hour: 16, minute: 0 },
    end: { date: 1, hour: 9, minute: 0 },
  },
};

const countRows = async (table: string, projectId: string): Promise<number> => {
  const row = await db
    .prepare(`SELECT count(*) AS n FROM ${table} WHERE project_id = ?`)
    .bind(projectId)
    .first<{ n: number }>();

  return row?.n ?? 0;
};

describe("create と get のラウンドトリップ", () => {
  test.each([
    ["general", general()],
    ["food-stall", foodStall()],
    ["laboratory", laboratory()],
    ["stage", stage()],
  ])("%s を保存して同じ値で読み戻せる", async (_type, project) => {
    await repository.create(project);

    expect(await repository.get(project.id)).toEqual(project);
  });

  test("タグと occasion の並び順を保つ", async () => {
    const project = foodStall({
      // tag 名の辞書順(drink, main, sweet)とは違う並びにして、
      // position 以外で並べ替えたら落ちるようにする。
      tag: [
        { tag: "sweet", tag2: "japanese" },
        { tag: "drink" },
        { tag: "main", tag2: "soup" },
      ],
      occasions: [
        occasionAt("east.wood-deck", 15),
        occasionAt("south.s3.s3-206", 9),
        occasionAt("west.lecture-hall-70", 12),
      ],
    });
    await repository.create(project);

    expect(await repository.get(project.id)).toEqual(project);
  });

  test("occasion もタグも空のまま保存できる", async () => {
    const project = general({ occasions: [], tag: [] });
    await repository.create(project);

    expect(await repository.get(project.id)).toEqual(project);
  });

  test("isTour が false の研究室企画を保存できる", async () => {
    const project = laboratory({ isTour: false });
    await repository.create(project);

    expect(await repository.get(project.id)).toEqual(project);
  });
});

describe("get", () => {
  test("存在しない ID には null を返す", async () => {
    expect(await repository.get("unknown")).toBeNull();
  });

  test("DB 上の値がモデルとして不正なら読み出しで失敗する", async () => {
    // place_id はコード側にしか定義がなく DB の制約を張れないため、
    // 読み出し時の検証が最後の砦になる。
    await repository.create(general());
    await db
      .prepare(`UPDATE project_occasions SET place_id = ? WHERE project_id = ?`)
      .bind("nonexistent.place", "g1")
      .run();

    await expect(repository.get("g1")).rejects.toThrow();
  });
});

describe("list", () => {
  test("保存した企画をすべて返す", async () => {
    await repository.create(general());
    await repository.create(foodStall());
    await repository.create(laboratory());

    const listed = await repository.list();

    expect(listed.map((project) => project.id).sort()).toEqual([
      "f1",
      "g1",
      "l1",
    ]);
  });

  test("企画をまたいで子を取り違えない", async () => {
    const a = general();
    const b = foodStall();
    const c = laboratory();
    await repository.create(a);
    await repository.create(b);
    await repository.create(c);

    const byId = new Map((await repository.list()).map((p) => [p.id, p]));

    expect(byId.get("g1")).toEqual(a);
    expect(byId.get("f1")).toEqual(b);
    expect(byId.get("l1")).toEqual(c);
  });

  test("空の DB には空配列を返す", async () => {
    expect(await repository.list()).toEqual([]);
  });
});

describe("create の原子性", () => {
  test("ID が重複したら失敗する", async () => {
    await repository.create(general());

    await expect(repository.create(general())).rejects.toThrow();
  });

  test("ID 重複時に既存の企画を壊さない", async () => {
    const original = general();
    await repository.create(original);

    await expect(
      repository.create(general({ projectName: "別の企画", tag: ["lecture"] })),
    ).rejects.toThrow();
    expect(await repository.get("g1")).toEqual(original);
  });

  test("子の書き込みに失敗したら企画そのものも残らない", async () => {
    await expect(
      repository.create(general({ occasions: [invalidOccasion] })),
    ).rejects.toThrow();

    expect(await repository.get("g1")).toBeNull();
    expect(await countRows("project_tags", "g1")).toBe(0);
    expect(await countRows("project_occasions", "g1")).toBe(0);
  });
});

describe("update", () => {
  test("基本情報を書き換える", async () => {
    await repository.create(general());
    const updated = general({ projectName: "改題", isRecommended: true });

    await repository.update(updated);

    expect(await repository.get("g1")).toEqual(updated);
  });

  test("タグと occasion を総入れ替えする(古いものが残らない)", async () => {
    await repository.create(general());
    const updated = general({
      tag: ["lecture"],
      occasions: [occasionAt("east.wood-deck", 14)],
    });

    await repository.update(updated);

    expect(await repository.get("g1")).toEqual(updated);
    expect(await countRows("project_tags", "g1")).toBe(1);
    expect(await countRows("project_occasions", "g1")).toBe(1);
  });

  test("タグと occasion を空にできる", async () => {
    await repository.create(general());
    const updated = general({ tag: [], occasions: [] });

    await repository.update(updated);

    expect(await repository.get("g1")).toEqual(updated);
    expect(await countRows("project_tags", "g1")).toBe(0);
  });

  test("種別をまたいで更新できる", async () => {
    await repository.create(general());
    const retyped = laboratory({ id: "g1", isTour: false });

    await repository.update(retyped);

    expect(await repository.get("g1")).toEqual(retyped);
    // 旧種別のタグが取り残されていないこと
    expect(await countRows("project_tags", "g1")).toBe(0);
  });

  test("書き込みに失敗したら更新前の状態が保たれる", async () => {
    const original = general();
    await repository.create(original);

    await expect(
      repository.update(
        general({ projectName: "改題", occasions: [invalidOccasion] }),
      ),
    ).rejects.toThrow();
    expect(await repository.get("g1")).toEqual(original);
  });
});

describe("存在しない企画の update / delete", () => {
  // 子の有無で失敗の仕方が変わらないこと。子があると外部キー違反、
  // なければ無言で成功、という非対称がかつてあった。
  test.each([
    ["子を持つ企画", general()],
    ["子を持たない企画", general({ tag: [], occasions: [] })],
  ])(
    "%s の update は ProjectNotFoundError を投げる",
    async (_name, project) => {
      await expect(repository.update(project)).rejects.toThrow(
        ProjectNotFoundError,
      );
    },
  );

  test("update に失敗したとき何も書き込まれない", async () => {
    await expect(repository.update(general())).rejects.toThrow(
      ProjectNotFoundError,
    );

    expect(await repository.get("g1")).toBeNull();
    expect(await countRows("project_occasions", "g1")).toBe(0);
  });

  test("delete は ProjectNotFoundError を投げる", async () => {
    await expect(repository.delete("g1")).rejects.toThrow(ProjectNotFoundError);
  });
});

describe("delete", () => {
  test("企画を削除する", async () => {
    await repository.create(general());

    await repository.delete("g1");

    expect(await repository.get("g1")).toBeNull();
  });

  test("タグと occasion も一緒に消える", async () => {
    await repository.create(general());

    await repository.delete("g1");

    expect(await countRows("project_tags", "g1")).toBe(0);
    expect(await countRows("project_occasions", "g1")).toBe(0);
  });

  test("他の企画には影響しない", async () => {
    const survivor = foodStall();
    await repository.create(general());
    await repository.create(survivor);

    await repository.delete("g1");

    expect(await repository.get("f1")).toEqual(survivor);
  });
});

describe("テストの前提", () => {
  test("各テストは空の DB から始まる", async () => {
    expect(await repository.list()).toEqual([]);
  });
});
