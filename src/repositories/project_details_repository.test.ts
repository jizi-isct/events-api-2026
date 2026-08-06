import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import type { Project, ProjectDetails, ProjectId } from "../models";
import { ProjectDetailsRepository } from "./project_details_repository";
import { ProjectNotFoundError, ProjectRepository } from "./project_repository";

const db = env.DB;

let detailsRepository: ProjectDetailsRepository;
let projectRepository: ProjectRepository;

beforeEach(async () => {
  // project_details は ON DELETE CASCADE で一緒に消える。
  await db.prepare(`DELETE FROM projects`).run();
  detailsRepository = new ProjectDetailsRepository(db);
  projectRepository = new ProjectRepository(db);
});

const project = (id: ProjectId): Project => ({
  id,
  type: "stage",
  groupName: "ステージ団体",
  projectName: `ステージ企画 ${id}`,
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [],
});

const completeDetails = (): ProjectDetails => ({
  additionalInfo: "整理券は10時から配布します。",
  menu: {
    items: [
      {
        name: "クレープ",
        price: 500,
        options: [{ name: "アイス追加", price: 100 }, { name: "ソースを選択" }],
      },
      {
        name: "日替わり商品",
        options: [],
      },
    ],
    description: "売り切れ次第終了します。",
  },
});

describe("save と get", () => {
  test("詳細情報を保存して同じ値で読み戻せる", async () => {
    await projectRepository.create(project("s1"));
    const details = completeDetails();

    await detailsRepository.save("s1", details);

    expect(await detailsRepository.get("s1")).toEqual(details);
  });

  test.each<[string, ProjectDetails]>([
    ["空の詳細情報", {}],
    ["追加情報のみ", { additionalInfo: "追加情報" }],
    [
      "メニューのみ",
      { menu: { items: [], description: "販売はありません。" } },
    ],
  ])("%sを保存できる", async (_name, details) => {
    await projectRepository.create(project("s1"));

    await detailsRepository.save("s1", details);

    expect(await detailsRepository.get("s1")).toEqual(details);
  });

  test("メニュー項目とオプションの並び順を保つ", async () => {
    await projectRepository.create(project("s1"));
    const details = completeDetails();

    await detailsRepository.save("s1", details);

    expect((await detailsRepository.get("s1"))?.menu?.items).toEqual(
      details.menu?.items,
    );
  });

  test("存在しない企画詳細には null を返す", async () => {
    expect(await detailsRepository.get("unknown")).toBeNull();
  });

  test("企画ごとに詳細情報を分離する", async () => {
    await projectRepository.create(project("s1"));
    await projectRepository.create(project("s2"));
    const first = completeDetails();
    const second = { additionalInfo: "別企画の情報" };

    await detailsRepository.save("s1", first);
    await detailsRepository.save("s2", second);

    expect(await detailsRepository.get("s1")).toEqual(first);
    expect(await detailsRepository.get("s2")).toEqual(second);
  });

  test("DB 上のメニューがモデルとして不正なら読み出しで失敗する", async () => {
    await projectRepository.create(project("s1"));
    await detailsRepository.save("s1", completeDetails());
    await db
      .prepare(`UPDATE project_details SET menu = ? WHERE project_id = ?`)
      .bind(JSON.stringify({ items: "invalid", description: "" }), "s1")
      .run();

    await expect(detailsRepository.get("s1")).rejects.toThrow();
  });
});

describe("save の上書き", () => {
  test("同じ企画 ID の詳細情報を丸ごと置き換える", async () => {
    await projectRepository.create(project("s1"));
    await detailsRepository.save("s1", completeDetails());
    const replacement = { additionalInfo: "変更後" };

    await detailsRepository.save("s1", replacement);

    expect(await detailsRepository.get("s1")).toEqual(replacement);
  });

  test("すべての optional 項目を取り除ける", async () => {
    await projectRepository.create(project("s1"));
    await detailsRepository.save("s1", completeDetails());

    await detailsRepository.save("s1", {});

    expect(await detailsRepository.get("s1")).toEqual({});
  });
});

describe("menu の個別操作", () => {
  test("menu だけを新規保存できる", async () => {
    await projectRepository.create(project("s1"));
    const menu = completeDetails().menu!;

    await detailsRepository.saveMenu("s1", menu);

    expect(await detailsRepository.get("s1")).toEqual({ menu });
  });

  test("menu を上書きしても additionalInfo を変更しない", async () => {
    await projectRepository.create(project("s1"));
    await detailsRepository.save("s1", completeDetails());
    const menu = { items: [], description: "販売終了" };

    await detailsRepository.saveMenu("s1", menu);

    expect(await detailsRepository.get("s1")).toEqual({
      additionalInfo: completeDetails().additionalInfo,
      menu,
    });
  });

  test("menu を削除しても additionalInfo を変更しない", async () => {
    await projectRepository.create(project("s1"));
    await detailsRepository.save("s1", completeDetails());

    await detailsRepository.deleteMenu("s1");

    expect(await detailsRepository.get("s1")).toEqual({
      additionalInfo: completeDetails().additionalInfo,
    });
  });

  test("詳細情報が未登録でも削除できる", async () => {
    await projectRepository.create(project("s1"));

    await detailsRepository.deleteMenu("s1");

    expect(await detailsRepository.get("s1")).toBeNull();
  });
});

describe("additionalInfo の個別操作", () => {
  test("additionalInfo だけを新規保存できる", async () => {
    await projectRepository.create(project("s1"));

    await detailsRepository.saveAdditionalInfo("s1", "追加情報");

    expect(await detailsRepository.get("s1")).toEqual({
      additionalInfo: "追加情報",
    });
  });

  test("additionalInfo を上書きしても menu を変更しない", async () => {
    await projectRepository.create(project("s1"));
    const details = completeDetails();
    await detailsRepository.save("s1", details);

    await detailsRepository.saveAdditionalInfo("s1", "変更後");

    expect(await detailsRepository.get("s1")).toEqual({
      additionalInfo: "変更後",
      menu: details.menu,
    });
  });

  test("additionalInfo を削除しても menu を変更しない", async () => {
    await projectRepository.create(project("s1"));
    const details = completeDetails();
    await detailsRepository.save("s1", details);

    await detailsRepository.deleteAdditionalInfo("s1");

    expect(await detailsRepository.get("s1")).toEqual({ menu: details.menu });
  });

  test("詳細情報が未登録でも削除できる", async () => {
    await projectRepository.create(project("s1"));

    await detailsRepository.deleteAdditionalInfo("s1");

    expect(await detailsRepository.get("s1")).toBeNull();
  });
});

describe("projects との参照整合性", () => {
  test("存在しない企画には詳細情報を保存できない", async () => {
    await expect(detailsRepository.save("unknown", {})).rejects.toThrow(
      ProjectNotFoundError,
    );
    expect(await detailsRepository.get("unknown")).toBeNull();
  });

  test.each([
    [
      "menu の保存",
      () => detailsRepository.saveMenu("unknown", completeDetails().menu!),
    ],
    ["menu の削除", () => detailsRepository.deleteMenu("unknown")],
    [
      "additionalInfo の保存",
      () => detailsRepository.saveAdditionalInfo("unknown", "追加情報"),
    ],
    [
      "additionalInfo の削除",
      () => detailsRepository.deleteAdditionalInfo("unknown"),
    ],
  ])("存在しない企画に対する%sは失敗する", async (_name, operation) => {
    await expect(operation()).rejects.toThrow(ProjectNotFoundError);
  });

  test("企画を削除すると詳細情報も削除される", async () => {
    await projectRepository.create(project("s1"));
    await detailsRepository.save("s1", completeDetails());

    await projectRepository.delete("s1");

    expect(await detailsRepository.get("s1")).toBeNull();
  });
});
