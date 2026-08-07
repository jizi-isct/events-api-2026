import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import app from "../index";
import { DEV_BYPASS_VALUE } from "../middleware/access";
import type { Menu, Project, ProjectDetails } from "../models";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectRepository } from "../repositories/project_repository";

const db = env.DB;
const projectRepository = new ProjectRepository(db);
const detailsRepository = new ProjectDetailsRepository(db);

const project: Project = {
  id: "g1",
  type: "general",
  groupName: "サークルA",
  projectName: "ミニ実験教室",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [],
  tag: ["experience"],
};

const originalMenu: Menu = {
  items: [
    {
      name: "クレープ",
      price: 500,
      options: [{ name: "アイス追加", price: 100 }],
    },
  ],
  description: "売り切れ次第終了します。",
};

const replacementMenu: Menu = {
  items: [{ name: "ドリンク", price: 200, options: [] }],
  description: "一人一点までです。",
};

const fullDetails: ProjectDetails = {
  additionalInfo: "整理券は10時から配布します。",
  menu: originalMenu,
};

beforeEach(async () => {
  await db.prepare(`DELETE FROM projects`).run();
});

const requestAdmin = async (
  path: string,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<Response> =>
  app.request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { ...env, ACCESS_DEV_BYPASS: DEV_BYPASS_VALUE },
  );

describe("Access による保護", () => {
  test("認証なしでは menu を書き換えられない", async () => {
    await projectRepository.create(project);

    const res = await app.request(
      "/admin/v1/projects/g1/details/menu",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(originalMenu),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await detailsRepository.get("g1")).toBeNull();
  });
});

describe("PUT /admin/v1/projects/:projectId/details/menu", () => {
  test("menu を新規保存する", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "PUT",
      originalMenu,
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await detailsRepository.get("g1")).toEqual({ menu: originalMenu });
  });

  test("menu だけを書き換える", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "PUT",
      replacementMenu,
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: fullDetails.additionalInfo,
      menu: replacementMenu,
    });
  });

  test("不正な menu は 400 で元の値を変更しない", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "PUT",
      { ...replacementMenu, items: [{ name: "商品", price: -1, options: [] }] },
    );

    expect(res.status).toBe(400);
    expect(await detailsRepository.get("g1")).toEqual(fullDetails);
  });
});

describe("DELETE /admin/v1/projects/:projectId/details/menu", () => {
  test("menu だけを undefined にする", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: fullDetails.additionalInfo,
    });
  });

  test("最後の項目を削除すると保存済みの空オブジェクトになる", async () => {
    await projectRepository.create(project);
    await detailsRepository.saveMenu("g1", originalMenu);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({});
  });

  test("詳細情報が未登録でも 204", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toBeNull();
  });
});

describe("PUT /admin/v1/projects/:projectId/details/additionalInfo", () => {
  test("additionalInfo を新規保存する", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "PUT",
      "追加情報",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: "追加情報",
    });
  });

  test("additionalInfo だけを書き換える", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "PUT",
      "変更後",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: "変更後",
      menu: originalMenu,
    });
  });

  test("文字列以外は 400 で元の値を変更しない", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "PUT",
      { additionalInfo: "オブジェクトは受け付けない" },
    );

    expect(res.status).toBe(400);
    expect(await detailsRepository.get("g1")).toEqual(fullDetails);
  });
});

describe("DELETE /admin/v1/projects/:projectId/details/additionalInfo", () => {
  test("additionalInfo だけを undefined にする", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({ menu: originalMenu });
  });

  test("最後の項目を削除すると保存済みの空オブジェクトになる", async () => {
    await projectRepository.create(project);
    await detailsRepository.saveAdditionalInfo("g1", "追加情報");

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({});
  });

  test("詳細情報が未登録でも 204", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toBeNull();
  });
});

describe("存在しない企画", () => {
  test.each([
    [
      "menu PUT",
      "/admin/v1/projects/unknown/details/menu",
      "PUT",
      originalMenu,
    ],
    ["menu DELETE", "/admin/v1/projects/unknown/details/menu", "DELETE"],
    [
      "additionalInfo PUT",
      "/admin/v1/projects/unknown/details/additionalInfo",
      "PUT",
      "追加情報",
    ],
    [
      "additionalInfo DELETE",
      "/admin/v1/projects/unknown/details/additionalInfo",
      "DELETE",
    ],
  ] as const)("%s は 404", async (_name, path, method, body?) => {
    const res = await requestAdmin(path, method, body);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message: "Unknown project ID: unknown",
    });
  });
});

describe("OpenAPI", () => {
  test("企画詳細情報の管理用エンドポイントを公開仕様に載せる", async () => {
    const res = await app.request("/openapi.json", undefined, env);
    const document = (await res.json()) as {
      paths: Record<
        string,
        | {
            put?: { operationId?: string };
            delete?: { operationId?: string };
          }
        | undefined
      >;
    };

    const menuPath =
      document.paths["/admin/v1/projects/{projectId}/details/menu"];
    const additionalInfoPath =
      document.paths["/admin/v1/projects/{projectId}/details/additionalInfo"];

    expect(menuPath?.put?.operationId).toBe("updateProjectMenu");
    expect(menuPath?.delete?.operationId).toBe("deleteProjectMenu");
    expect(additionalInfoPath?.put?.operationId).toBe(
      "updateProjectAdditionalInfo",
    );
    expect(additionalInfoPath?.delete?.operationId).toBe(
      "deleteProjectAdditionalInfo",
    );
  });
});
